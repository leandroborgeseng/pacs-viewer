const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Admin123!', 10);
  const medicoHash = await bcrypt.hash('Medico123!', 10);
  const pacienteHash = await bcrypt.hash('Paciente123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@portal.local' },
    update: {
      passwordHash: adminHash,
      active: true,
      name: 'Administrador',
      role: Role.ADMIN,
    },
    create: {
      email: 'admin@portal.local',
      name: 'Administrador',
      role: Role.ADMIN,
      passwordHash: adminHash,
    },
  });

  await prisma.user.upsert({
    where: { email: 'medico@portal.local' },
    update: {
      passwordHash: medicoHash,
      active: true,
      name: 'Dra. Helena Vieira',
      role: Role.MEDICO,
    },
    create: {
      email: 'medico@portal.local',
      name: 'Dra. Helena Vieira',
      role: Role.MEDICO,
      passwordHash: medicoHash,
    },
  });

  const pacienteUser = await prisma.user.upsert({
    where: { email: 'paciente@portal.local' },
    update: {
      passwordHash: pacienteHash,
      active: true,
      name: 'João Silva',
      role: Role.PACIENTE,
    },
    create: {
      email: 'paciente@portal.local',
      name: 'João Silva',
      role: Role.PACIENTE,
      passwordHash: pacienteHash,
    },
  });

  const patient = await prisma.patient.upsert({
    where: { medicalRecordNumber: 'PAC0001' },
    update: {
      userId: pacienteUser.id,
      fullName: 'João Silva',
    },
    create: {
      medicalRecordNumber: 'PAC0001',
      fullName: 'João Silva',
      userId: pacienteUser.id,
    },
  });

  const studyInstanceUID =
    process.env.SEED_STUDY_INSTANCE_UID || '1.2.3.4.5.6.7.8.9.10.11.12';

  const study = await prisma.study.upsert({
    where: { studyInstanceUID },
    update: { patientId: patient.id },
    create: {
      patientId: patient.id,
      studyInstanceUID,
      studyDescription: 'RM Joelho — exemplo (sincronize com Orthanc)',
      studyDate: '20240101',
      accessionNumber: 'ACC-2024-001',
      modality: 'MR',
    },
  });

  const medico = await prisma.user.findUniqueOrThrow({
    where: { email: 'medico@portal.local' },
  });

  await prisma.studyPermission.upsert({
    where: {
      userId_studyId: { userId: medico.id, studyId: study.id },
    },
    update: {},
    create: {
      userId: medico.id,
      studyId: study.id,
    },
  });

  console.log(
    'Seed concluído. Contas: admin@portal.local, medico@portal.local, paciente@portal.local (ver README). Opcional: SEED_STUDY_INSTANCE_UID para UID Orthanc.',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
