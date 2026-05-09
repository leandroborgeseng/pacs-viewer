import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { Request, Response } from 'express';
import { DicomAccessService } from './dicom-access.service';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

const STUDY_UID_TAG = '0020000D';

@Injectable()
export class DicomWebService {
  private readonly logger = new Logger(DicomWebService.name);

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private access: DicomAccessService,
  ) {}

  private upstreamBase(): string {
    const base =
      this.config.get<string>('ORTHANC_DICOMWEB_ROOT') ??
      'http://localhost:8042/dicom-web';
    return base.replace(/\/$/, '');
  }

  async proxy(req: Request, res: Response, user: RequestUser) {
    const upstreamUrl = this.buildUpstreamUrl(req);
    const studyFromPath = this.extractStudyUidFromPath(upstreamUrl.pathname);
    const allowed = await this.access.getAllowedStudyInstanceUIDs(user);

    if (studyFromPath && !this.isAllowed(studyFromPath, allowed, user.role)) {
      this.logJson({
        event: 'dicomweb.access_denied',
        clientPath: this.redactClientPath(req.originalUrl ?? ''),
        upstreamPath: upstreamUrl.pathname,
        studyInstanceUID: studyFromPath,
        userId: user.sub,
        role: user.role,
      });
      throw new ForbiddenException('Sem acesso a este estudo DICOMweb');
    }

    const method = (req.method ?? 'GET').toUpperCase();
    const headers = this.buildUpstreamHeaders(req);
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs =
        Math.round(Number(process.hrtime.bigint() - t0) / 1e6) / 1000;
      const len = res.getHeader('content-length');
      this.logJson({
        event: 'dicomweb.proxy',
        method,
        clientPath: this.redactClientPath(req.originalUrl ?? ''),
        upstreamPath: `${upstreamUrl.pathname}${upstreamUrl.search}`,
        statusCode: res.statusCode,
        durationMs,
        userId: user.sub,
        role: user.role,
        bytesOut:
          typeof len === 'number'
            ? len
            : typeof len === 'string'
              ? Number.parseInt(len, 10)
              : undefined,
      });
    });

    try {
      const response = await firstValueFrom(
        this.http.request<ArrayBuffer>({
          method: method as never,
          url: upstreamUrl.toString(),
          headers,
          data: ['GET', 'HEAD'].includes(method) ? undefined : req,
          responseType: 'arraybuffer',
          validateStatus: () => true,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      const contentType = String(response.headers['content-type'] ?? '');
      const p = upstreamUrl.pathname;
      const isJsonStudies =
        method === 'GET' &&
        p === '/studies' &&
        contentType.includes('application/dicom+json');

      if (isJsonStudies && user.role !== Role.ADMIN) {
        const filtered = this.filterStudiesResponse(
          Buffer.from(response.data),
          allowed,
        );
        this.forwardHeaders(res, response.headers, filtered.length);
        res.status(response.status).send(filtered);
        return;
      }

      const body = Buffer.from(response.data);
      this.forwardHeaders(res, response.headers, body.length);
      res.status(response.status).send(body);
    } catch (err) {
      this.logJson({
        event: 'dicomweb.upstream_error',
        clientPath: this.redactClientPath(req.originalUrl ?? ''),
        upstreamPath: upstreamUrl.toString().split('?')[0],
        method,
        userId: user.sub,
        role: user.role,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ServiceUnavailableException(
        'Orthanc/DICOMweb indisponível. Verifique ORTHANC_DICOMWEB_ROOT.',
      );
    }
  }

  private logJson(payload: Record<string, unknown>) {
    this.logger.log(JSON.stringify(payload));
  }

  /** Remove credenciais sensíveis da query (ex.: access_token no OHIF). */
  private redactClientPath(pathAndQuery: string): string {
    const qIdx = pathAndQuery.indexOf('?');
    if (qIdx < 0) return pathAndQuery;
    const path = pathAndQuery.slice(0, qIdx);
    const qs = pathAndQuery.slice(qIdx + 1);
    try {
      const sp = new URLSearchParams(qs);
      if (sp.has('access_token')) sp.set('access_token', '[redacted]');
      const next = sp.toString();
      return next ? `${path}?${next}` : path;
    } catch {
      return `${path}?[unparsed-query]`;
    }
  }

  private filterStudiesResponse(buf: Buffer, allowed: Set<string>): Buffer {
    try {
      const text = buf.toString('utf8');
      const parsed = JSON.parse(text) as unknown[];
      if (!Array.isArray(parsed)) return buf;
      const next = parsed.filter((item) => {
        const uid = this.readStudyUidFromDicomJson(item);
        return uid && allowed.has(uid);
      });
      return Buffer.from(JSON.stringify(next), 'utf8');
    } catch {
      return buf;
    }
  }

  private readStudyUidFromDicomJson(item: unknown): string | null {
    if (!item || typeof item !== 'object') return null;
    const tag = (item as Record<string, { Value?: string[] }>)[STUDY_UID_TAG];
    const v = tag?.Value?.[0];
    return typeof v === 'string' ? v : null;
  }

  private isAllowed(
    studyUid: string,
    allowed: Set<string>,
    role: Role,
  ): boolean {
    if (role === Role.ADMIN) return true;
    return allowed.has(studyUid);
  }

  private extractStudyUidFromPath(pathname: string): string | null {
    const m = pathname.match(/\/studies\/([^/]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  }

  private buildUpstreamHeaders(req: Request): Record<string, string> {
    const forward: Record<string, string> = {};
    const hop = new Set([
      'host',
      'connection',
      'content-length',
      'authorization',
    ]);
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v || hop.has(k.toLowerCase())) continue;
      if (Array.isArray(v)) forward[k] = v.join(', ');
      else forward[k] = v;
    }
    const user = this.config.get<string>('ORTHANC_USERNAME');
    const pass = this.config.get<string>('ORTHANC_PASSWORD');
    if (user && pass) {
      const token = Buffer.from(`${user}:${pass}`).toString('base64');
      forward['authorization'] = `Basic ${token}`;
    }
    const accept = forward['accept'] ?? req.headers['accept'];
    forward['accept'] =
      typeof accept === 'string' && accept.length > 0
        ? accept
        : 'application/dicom+json, multipart/related; type="application/dicom+xml"';
    return forward;
  }

  private forwardHeaders(
    res: Response,
    incoming: Record<string, unknown>,
    bodyLength: number,
  ) {
    const skip = new Set([
      'connection',
      'transfer-encoding',
      'content-length',
      'content-encoding',
    ]);
    for (const [key, val] of Object.entries(incoming)) {
      if (!val || skip.has(key.toLowerCase())) continue;
      if (Array.isArray(val)) {
        res.setHeader(key, val as string[]);
      } else if (typeof val === 'string') {
        res.setHeader(key, val);
      }
    }
    res.setHeader('content-length', bodyLength.toString());
  }

  private buildUpstreamUrl(req: Request): URL {
    const base = this.upstreamBase();
    const rawPath = req.originalUrl.split('?')[0] ?? '';
    const searchParams = new URLSearchParams(
      req.originalUrl.includes('?')
        ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1)
        : '',
    );
    searchParams.delete('access_token');
    const q = searchParams.toString();
    const query = q ? `?${q}` : '';

    let relative = rawPath;
    for (const p of ['/api/dicomweb', '/dicomweb']) {
      if (relative.startsWith(p)) {
        relative = relative.slice(p.length) || '/';
        break;
      }
    }
    if (!relative.startsWith('/')) relative = `/${relative}`;
    return new URL(`${base}${relative}${query}`);
  }
}