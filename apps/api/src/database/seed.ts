import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ALL_PERMISSION_KEYS, BEFORE_AFTER_FOOD_OPTIONS, MEDICINE_FORMS, type PermissionKey } from '@clinic-care/shared-types';

const prisma = new PrismaClient();

// Mirrors the real front-desk / nurse / doctor split: reception books and runs the
// queue but never touches clinical records; the nurse (ASSISTANT) records vitals but
// can't diagnose or prescribe; only the doctor edits the actual visit.
const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  ADMIN: [...ALL_PERMISSION_KEYS],
  DOCTOR: [
    'patients:view',
    'patients:edit',
    'appointments:view',
    'appointments:edit',
    'visits:view',
    'visits:edit',
    'vitals:view',
    'vitals:edit',
    'prescriptions:view',
    'prescriptions:edit',
    'medicines:view',
    'medicines:edit',
    'billing-charges:edit',
  ],
  RECEPTIONIST: [
    'patients:view',
    'patients:edit',
    'appointments:view',
    'appointments:edit',
    'visits:view',
    'medicines:view',
    'billing:view',
    'billing:edit',
    'billing-charges:edit',
  ],
  ASSISTANT: [
    'patients:view',
    'appointments:view',
    'visits:view',
    'vitals:view',
    'vitals:edit',
    'medicines:view',
    'billing-charges:edit',
  ],
};

async function main() {
  const roleNames = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT'] as const;
  const roles: Record<string, { id: string }> = {};

  for (const name of roleNames) {
    const data = {
      permissions: JSON.stringify(ROLE_PERMISSIONS[name]),
      isLocked: name === 'ADMIN',
    };
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: data,
      create: { name, ...data },
    });
  }

  // Blank placeholder — the real profile is filled in from Settings > Clinic Profile after
  // first login, not seeded. A row must exist (getProfile() 404s otherwise), but its content
  // isn't demo data.
  await prisma.clinic.upsert({
    where: { id: 'primary-clinic' },
    update: {},
    create: { id: 'primary-clinic', name: '' },
  });

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Administrator',
      username: 'admin',
      passwordHash: adminPasswordHash,
      pin: await bcrypt.hash('1234', 10),
      roleId: roles.ADMIN.id,
    },
  });

  const counters = [
    { key: 'PATIENT', prefix: 'P' },
    { key: 'VISIT', prefix: 'V' },
    { key: 'BILL', prefix: 'B' },
    { key: 'CERTIFICATE', prefix: 'C' },
  ];
  const financialYear = '2526';

  for (const counter of counters) {
    await prisma.counter.upsert({
      where: { key: counter.key },
      update: {},
      create: { ...counter, currentValue: 0, financialYear },
    });
  }

  const paymentAccounts = [
    { name: 'Cash Counter', type: 'CASH' as const, openingBalance: 0, openingBalanceDate: new Date(), isDefault: true },
    { name: 'Main Bank Account', type: 'BANK' as const, openingBalance: 0, openingBalanceDate: new Date(), isDefault: true },
    { name: 'UPI Account', type: 'BANK' as const, openingBalance: 0, openingBalanceDate: new Date(), isDefault: false },
  ];

  for (const account of paymentAccounts) {
    await prisma.paymentAccount.upsert({
      where: { name: account.name },
      update: { type: account.type },
      create: account,
    });
  }

  // Seeds one PatientFieldDefinition per built-in Patient form field so admin can
  // toggle their visibility/required-ness from Settings → Patient Fields the same
  // way as custom ones. isCore locks key/fieldType (tied to the real column); label,
  // required and isActive stay editable. required here mirrors today's hardcoded
  // behavior so nothing changes until admin actually touches a toggle.
  const coreFields = [
    { key: 'name', label: 'Full Name', fieldType: 'TEXT', required: true, order: 0 },
    { key: 'gender', label: 'Gender', fieldType: 'SELECT', options: ['MALE', 'FEMALE', 'OTHER'], required: true, order: 1 },
    { key: 'dob', label: 'Date of Birth', fieldType: 'DATE', required: false, order: 2 },
    { key: 'age', label: 'Age', fieldType: 'NUMBER', required: true, order: 3 },
    { key: 'mobile', label: 'Mobile Number', fieldType: 'TEXT', required: true, order: 4 },
    { key: 'altMobile', label: 'Alternate Mobile', fieldType: 'TEXT', required: false, order: 5 },
    { key: 'email', label: 'Email', fieldType: 'TEXT', required: false, order: 6 },
    { key: 'address', label: 'Address', fieldType: 'TEXT', required: true, order: 7 },
    { key: 'city', label: 'City', fieldType: 'TEXT', required: false, order: 8 },
    { key: 'pincode', label: 'Pincode', fieldType: 'TEXT', required: false, order: 9 },
    {
      key: 'bloodGroup',
      label: 'Blood Group',
      fieldType: 'SELECT',
      options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: false,
      order: 10,
    },
    {
      key: 'maritalStatus',
      label: 'Marital Status',
      fieldType: 'SELECT',
      options: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'],
      required: false,
      order: 11,
    },
    { key: 'occupation', label: 'Occupation', fieldType: 'TEXT', required: false, order: 12 },
    { key: 'referredBy', label: 'Referred By', fieldType: 'TEXT', required: false, order: 13 },
    { key: 'stage', label: 'Stage', fieldType: 'TEXT', required: true, order: 14 },
    { key: 'allergies', label: 'Allergies', fieldType: 'TEXT', required: false, order: 15 },
    { key: 'chronicDiseases', label: 'Diseases / Conditions', fieldType: 'TEXT', required: true, order: 16 },
    { key: 'notes', label: 'Notes', fieldType: 'TEXT', required: false, order: 17 },
  ];

  for (const field of coreFields) {
    await prisma.patientFieldDefinition.upsert({
      where: { key: field.key },
      update: {},
      create: {
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        options: 'options' in field ? JSON.stringify(field.options) : null,
        required: field.required,
        order: field.order,
        isCore: true,
      },
    });
  }

  // Same idea as coreFields above, but for the Medicine master. Only brandName and
  // form are required today; everything else already defaults or is nullable.
  const coreMedicineFields = [
    { key: 'brandName', label: 'Brand Name', fieldType: 'TEXT', required: true, order: 0 },
    { key: 'genericName', label: 'Generic Name (Salt)', fieldType: 'TEXT', required: false, order: 1 },
    { key: 'strength', label: 'Strength', fieldType: 'TEXT', required: false, order: 2 },
    {
      key: 'form',
      label: 'Form',
      fieldType: 'SELECT',
      options: MEDICINE_FORMS.filter((f) => f !== 'UNSPECIFIED'),
      required: true,
      order: 3,
    },
    { key: 'company', label: 'Company', fieldType: 'TEXT', required: false, order: 4 },
    { key: 'category', label: 'Category', fieldType: 'TEXT', required: false, order: 5 },
    { key: 'defaultDose', label: 'Default Dose Text', fieldType: 'TEXT', required: false, order: 6 },
    { key: 'defaultMorning', label: 'Default Morning Dose', fieldType: 'NUMBER', required: false, order: 7 },
    { key: 'defaultAfternoon', label: 'Default Afternoon Dose', fieldType: 'NUMBER', required: false, order: 8 },
    { key: 'defaultEvening', label: 'Default Evening Dose', fieldType: 'NUMBER', required: false, order: 9 },
    { key: 'defaultNight', label: 'Default Night Dose', fieldType: 'NUMBER', required: false, order: 10 },
    {
      key: 'defaultBeforeAfterFood',
      label: 'Before/After Food',
      fieldType: 'SELECT',
      options: BEFORE_AFTER_FOOD_OPTIONS,
      required: false,
      order: 11,
    },
    { key: 'defaultDurationDays', label: 'Default Duration (Days)', fieldType: 'NUMBER', required: false, order: 12 },
    { key: 'defaultInstruction', label: 'Default Instruction', fieldType: 'TEXT', required: false, order: 13 },
  ];

  for (const field of coreMedicineFields) {
    await prisma.medicineFieldDefinition.upsert({
      where: { key: field.key },
      update: {},
      create: {
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        options: 'options' in field ? JSON.stringify(field.options) : null,
        required: field.required,
        order: field.order,
        isCore: true,
      },
    });
  }

  const coreVisitFields = [
    { key: 'bp', label: 'BP', fieldType: 'TEXT', required: false, order: 0 },
    { key: 'pulse', label: 'Pulse', fieldType: 'NUMBER', required: false, order: 1 },
    { key: 'temperature', label: 'Temperature', fieldType: 'NUMBER', required: false, order: 2 },
    { key: 'spo2', label: 'SpO2', fieldType: 'NUMBER', required: false, order: 3 },
    { key: 'weight', label: 'Weight', fieldType: 'NUMBER', required: false, order: 4 },
    { key: 'height', label: 'Height', fieldType: 'NUMBER', required: false, order: 5 },
    { key: 'sugarRandom', label: 'Random Sugar', fieldType: 'NUMBER', required: false, order: 6 },
    { key: 'vitalNotes', label: 'Vital Notes', fieldType: 'TEXT', required: false, order: 7 },
    { key: 'complaint', label: 'Chief Complaint', fieldType: 'TEXT', required: false, order: 8 },
    { key: 'complaintDurationDays', label: 'Duration (Days)', fieldType: 'NUMBER', required: false, order: 9 },
    { key: 'examination', label: 'Examination Findings', fieldType: 'TEXT', required: false, order: 10 },
    { key: 'diagnosis', label: 'Diagnosis', fieldType: 'TEXT', required: false, order: 11 },
    { key: 'testsAdvised', label: 'Tests Advised', fieldType: 'TEXT', required: false, order: 12 },
    { key: 'billableCharges', label: 'Billable Treatment Charges', fieldType: 'TEXT', required: false, order: 13 },
    { key: 'advice', label: 'Advice / Instructions', fieldType: 'TEXT', required: false, order: 14 },
    { key: 'consultationFee', label: 'Consultation Fee', fieldType: 'NUMBER', required: false, order: 15 },
    { key: 'nextFollowUpDate', label: 'Next Follow-up Date', fieldType: 'DATE', required: false, order: 16 },
    { key: 'remark', label: 'Remark', fieldType: 'TEXT', required: false, order: 17 },
  ];

  for (const field of coreVisitFields) {
    await prisma.visitFieldDefinition.upsert({
      where: { key: field.key },
      update: {},
      create: {
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        required: field.required,
        order: field.order,
        isCore: true,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete: admin/admin123 (default payment accounts only; no patients, medicines, or fee types seeded)');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
