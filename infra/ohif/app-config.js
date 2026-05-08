/**
 * @deprecated Legado (contentor OHIF separado). Em produção o OHIF é compilado
 * dentro da imagem Docker do Next (`web/Dockerfile`) e servido em /ohif;
 * o ficheiro efetivo é gerado por web/scripts/write-ohif-app-config.mjs no build.
 *
 * -----------------------------------------------------------------------------
 * Configuração OHIF v3 — aponte os roots DICOMweb para o **backend** Nest (proxy).
 */
// eslint-disable-next-line no-undef
window.config = {
  routerBasename: '/',
  showStudyList: true,
  extensions: [],
  modes: [],
  defaultDataSourceName: 'dicomweb',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'Portal (proxy seguro)',
        name: 'dicomweb',
        // Troque se o browser não conseguir alcançar localhost (ex.: outro host na rede)
        wadoUriRoot: 'http://localhost:3001/api/dicomweb',
        qidoRoot: 'http://localhost:3001/api/dicomweb',
        wadoRoot: 'http://localhost:3001/api/dicomweb',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        singlepart: 'bulkdata,video,pdf',
        requestOptions: {
          auth: (xhr) => {
            try {
              const params = new URLSearchParams(window.location.search);
              const token =
                params.get('access_token') || params.get('token');
              if (token) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + token);
              }
            } catch {
              /* ignore */
            }
          },
        },
      },
    },
  ],
};

// Perfil paciente: URL com hash #patient — reduz funcionalidades avançadas quando suportado pela sua build OHIF
// (ajuste conforme extensões instaladas).
// eslint-disable-next-line no-undef
if (typeof window !== 'undefined' && window.location.hash === '#patient') {
  // eslint-disable-next-line no-undef
  window.config = Object.assign({}, window.config, {
    showStudyList: false,
  });
}
