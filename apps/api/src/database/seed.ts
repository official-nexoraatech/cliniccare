import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const roleNames = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT'] as const;
  const roles: Record<string, { id: string }> = {};

  for (const name of roleNames) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await prisma.clinic.upsert({
    where: { id: 'demo-clinic' },
    update: {},
    create: {
      id: 'demo-clinic',
      name: 'ClinicCare Demo Clinic',
      address: '123 MG Road, Bengaluru',
      phone: '+91 90000 00000',
      doctorName: 'Dr. A. Sharma',
      degree: 'MBBS, MD',
      regnNumber: 'KMC-123456',
    },
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

  const doctorPasswordHash = await bcrypt.hash('doctor123', 10);
  await prisma.user.upsert({
    where: { username: 'doctor' },
    update: {},
    create: {
      name: 'Dr. A. Sharma',
      username: 'doctor',
      passwordHash: doctorPasswordHash,
      pin: await bcrypt.hash('1111', 10),
      roleId: roles.DOCTOR.id,
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

  const demoPatients = [
    { seq: 1, name: 'Ramesh Kumar', age: 45, gender: 'MALE', mobile: '9845012301', city: 'Bengaluru', bloodGroup: 'B+', allergies: null, chronicDiseases: 'Type 2 Diabetes' },
    { seq: 2, name: 'Sunita Sharma', age: 32, gender: 'FEMALE', mobile: '9845012302', city: 'Bengaluru', bloodGroup: 'O+', allergies: 'Penicillin', chronicDiseases: null },
    { seq: 3, name: 'Arjun Reddy', age: 28, gender: 'MALE', mobile: '9845012303', city: 'Hyderabad', bloodGroup: 'A+', allergies: null, chronicDiseases: null },
    { seq: 4, name: 'Priya Nair', age: 55, gender: 'FEMALE', mobile: '9845012304', city: 'Kochi', bloodGroup: 'AB+', allergies: null, chronicDiseases: 'Hypertension' },
    { seq: 5, name: 'Mohammed Iqbal', age: 61, gender: 'MALE', mobile: '9845012305', city: 'Bengaluru', bloodGroup: 'O-', allergies: 'Sulfa drugs', chronicDiseases: 'Hypertension, Asthma' },
    { seq: 6, name: 'Lakshmi Iyer', age: 39, gender: 'FEMALE', mobile: '9845012306', city: 'Chennai', bloodGroup: 'B-', allergies: null, chronicDiseases: null },
    { seq: 7, name: 'Vikram Singh', age: 24, gender: 'MALE', mobile: '9845012307', city: 'Bengaluru', bloodGroup: 'A-', allergies: null, chronicDiseases: null },
    { seq: 8, name: 'Anjali Desai', age: 70, gender: 'FEMALE', mobile: '9845012308', city: 'Mumbai', bloodGroup: 'O+', allergies: null, chronicDiseases: 'Type 2 Diabetes, Arthritis' },
    { seq: 9, name: 'Suresh Gowda', age: 18, gender: 'MALE', mobile: '9845012309', city: 'Mysuru', bloodGroup: 'B+', allergies: 'Peanuts', chronicDiseases: null },
    { seq: 10, name: 'Kavya Rao', age: 42, gender: 'FEMALE', mobile: '9845012310', city: 'Bengaluru', bloodGroup: 'AB-', allergies: null, chronicDiseases: null },
    { seq: 11, name: 'Deepak Verma', age: 50, gender: 'MALE', mobile: '9845012311', city: 'Delhi', bloodGroup: 'A+', allergies: null, chronicDiseases: 'Hypertension' },
    { seq: 12, name: 'Meena Pillai', age: 6, gender: 'FEMALE', mobile: '9845012312', city: 'Kochi', bloodGroup: 'O+', allergies: null, chronicDiseases: null },
    { seq: 13, name: 'Rajesh Khanna', age: 66, gender: 'MALE', mobile: '9845012313', city: 'Bengaluru', bloodGroup: 'B+', allergies: null, chronicDiseases: 'Coronary Artery Disease' },
    { seq: 14, name: 'Fatima Sheikh', age: 35, gender: 'FEMALE', mobile: '9845012314', city: 'Hyderabad', bloodGroup: 'A+', allergies: 'Latex', chronicDiseases: null },
    { seq: 15, name: 'Karthik Subramaniam', age: 47, gender: 'MALE', mobile: '9845012315', city: 'Chennai', bloodGroup: 'O+', allergies: null, chronicDiseases: null },
  ] as const;

  for (const p of demoPatients) {
    const patientId = `P-${financialYear}-${String(p.seq).padStart(5, '0')}`;
    await prisma.patient.upsert({
      where: { id: `demo-patient-${p.seq}` },
      update: {},
      create: {
        id: `demo-patient-${p.seq}`,
        patientId,
        name: p.name,
        age: p.age,
        gender: p.gender,
        mobile: p.mobile,
        city: p.city,
        bloodGroup: p.bloodGroup,
        allergies: p.allergies ?? undefined,
        chronicDiseases: p.chronicDiseases ?? undefined,
      },
    });
  }

  const patientCounter = await prisma.counter.findUniqueOrThrow({ where: { key: 'PATIENT' } });
  if (patientCounter.currentValue < demoPatients.length) {
    await prisma.counter.update({
      where: { key: 'PATIENT' },
      data: { currentValue: demoPatients.length },
    });
  }

  const demoMedicines = [
    { brandName: 'Crocin', genericName: 'Paracetamol', strength: '500mg', form: 'TABLET', company: 'GSK', category: 'Analgesic/Antipyretic', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 3 },
    { brandName: 'Dolo', genericName: 'Paracetamol', strength: '650mg', form: 'TABLET', company: 'Micro Labs', category: 'Analgesic/Antipyretic', dose: { m: 1, a: 1, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 3 },
    { brandName: 'Augmentin', genericName: 'Amoxicillin + Clavulanic Acid', strength: '625mg', form: 'TABLET', company: 'GSK', category: 'Antibiotic', dose: { m: 1, a: 0, e: 1, n: 0 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Mox', genericName: 'Amoxicillin', strength: '500mg', form: 'CAPSULE', company: 'Ranbaxy', category: 'Antibiotic', dose: { m: 1, a: 1, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Pantocid', genericName: 'Pantoprazole', strength: '40mg', form: 'TABLET', company: 'Sun Pharma', category: 'Antacid/PPI', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'BEFORE_FOOD', days: 10 },
    { brandName: 'Pan-D', genericName: 'Pantoprazole + Domperidone', strength: '40mg', form: 'CAPSULE', company: 'Alkem', category: 'Antacid/PPI', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'BEFORE_FOOD', days: 7 },
    { brandName: 'Glycomet', genericName: 'Metformin', strength: '500mg', form: 'TABLET', company: 'USV', category: 'Antidiabetic', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 30 },
    { brandName: 'Amaryl', genericName: 'Glimepiride', strength: '1mg', form: 'TABLET', company: 'Sanofi', category: 'Antidiabetic', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'BEFORE_FOOD', days: 30 },
    { brandName: 'Amlong', genericName: 'Amlodipine', strength: '5mg', form: 'TABLET', company: 'Micro Labs', category: 'Antihypertensive', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'ANYTIME', days: 30 },
    { brandName: 'Telma', genericName: 'Telmisartan', strength: '40mg', form: 'TABLET', company: 'Glenmark', category: 'Antihypertensive', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'ANYTIME', days: 30 },
    { brandName: 'Cetzine', genericName: 'Cetirizine', strength: '10mg', form: 'TABLET', company: 'GSK', category: 'Antihistamine', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'ANYTIME', days: 5 },
    { brandName: 'Allegra', genericName: 'Fexofenadine', strength: '120mg', form: 'TABLET', company: 'Sanofi', category: 'Antihistamine', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'ANYTIME', days: 5 },
    { brandName: 'Azithral', genericName: 'Azithromycin', strength: '500mg', form: 'TABLET', company: 'Alembic', category: 'Antibiotic', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'BEFORE_FOOD', days: 3 },
    { brandName: 'Electral', genericName: 'ORS', strength: null, form: 'POWDER', company: 'FDC', category: 'Rehydration', dose: { m: 1, a: 1, e: 1, n: 1 }, food: 'ANYTIME', days: 3 },
    { brandName: 'Sinarest', genericName: 'Paracetamol + Phenylephrine + Chlorpheniramine', strength: null, form: 'TABLET', company: 'Centaur', category: 'Cold & Flu', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 4 },
    { brandName: 'Vicks Action 500', genericName: 'Paracetamol + Phenylephrine + Caffeine', strength: null, form: 'TABLET', company: 'P&G', category: 'Cold & Flu', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 4 },
    { brandName: 'Zerodol-SP', genericName: 'Aceclofenac + Paracetamol + Serratiopeptidase', strength: null, form: 'TABLET', company: 'Ipca', category: 'Pain/Inflammation', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Combiflam', genericName: 'Ibuprofen + Paracetamol', strength: null, form: 'TABLET', company: 'Sanofi', category: 'Pain/Inflammation', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 3 },
    { brandName: 'Ecosprin', genericName: 'Aspirin', strength: '75mg', form: 'TABLET', company: 'USV', category: 'Antiplatelet', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'AFTER_FOOD', days: 30 },
    { brandName: 'Rosuvas', genericName: 'Rosuvastatin', strength: '10mg', form: 'TABLET', company: 'Sun Pharma', category: 'Lipid-lowering', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'ANYTIME', days: 30 },
    { brandName: 'Thyronorm', genericName: 'Levothyroxine', strength: '50mcg', form: 'TABLET', company: 'Abbott', category: 'Thyroid', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'EMPTY_STOMACH', days: 30 },
    { brandName: 'Metrogyl', genericName: 'Metronidazole', strength: '400mg', form: 'TABLET', company: 'JB Chemicals', category: 'Antibiotic', dose: { m: 1, a: 1, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Ciplox', genericName: 'Ciprofloxacin', strength: '500mg', form: 'TABLET', company: 'Cipla', category: 'Antibiotic', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Volini', genericName: 'Diclofenac Gel', strength: '1%', form: 'OINTMENT', company: 'Sun Pharma', category: 'Topical Pain Relief', dose: { m: 0, a: 0, e: 0, n: 0 }, food: 'ANYTIME', days: 7 },
    { brandName: 'Betadine', genericName: 'Povidone Iodine', strength: '5%', form: 'OINTMENT', company: 'Win-Medicare', category: 'Antiseptic', dose: { m: 0, a: 0, e: 0, n: 0 }, food: 'ANYTIME', days: 7 },
    { brandName: 'Ascoril', genericName: 'Bromhexine + Terbutaline + Guaifenesin', strength: null, form: 'SYRUP', company: 'Glenmark', category: 'Cough', dose: { m: 1, a: 0, e: 1, n: 1 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Benadryl', genericName: 'Diphenhydramine', strength: null, form: 'SYRUP', company: 'J&J', category: 'Cough', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Digene', genericName: 'Antacid (Mg + Al Hydroxide)', strength: null, form: 'SYRUP', company: 'Abbott', category: 'Antacid', dose: { m: 1, a: 1, e: 1, n: 0 }, food: 'AFTER_FOOD', days: 5 },
    { brandName: 'Eno', genericName: 'Antacid (Sodium Bicarbonate)', strength: null, form: 'POWDER', company: 'GSK', category: 'Antacid', dose: { m: 0, a: 1, e: 0, n: 0 }, food: 'AFTER_FOOD', days: 3 },
    { brandName: 'Cyra-D', genericName: 'Rabeprazole + Domperidone', strength: '20mg', form: 'CAPSULE', company: 'Cipla', category: 'Antacid/PPI', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'BEFORE_FOOD', days: 10 },
    { brandName: 'Zyrtec', genericName: 'Cetirizine', strength: '10mg', form: 'TABLET', company: 'UCB', category: 'Antihistamine', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'ANYTIME', days: 5 },
    { brandName: 'Asthalin', genericName: 'Salbutamol', strength: '100mcg', form: 'OTHER', company: 'Cipla', category: 'Bronchodilator (Inhaler)', dose: { m: 0, a: 0, e: 0, n: 0 }, food: 'ANYTIME', days: 30 },
    { brandName: 'Monticope', genericName: 'Montelukast + Levocetirizine', strength: '10mg', form: 'TABLET', company: 'Cipla', category: 'Allergy/Asthma', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 15 },
    { brandName: 'Folvite', genericName: 'Folic Acid', strength: '5mg', form: 'TABLET', company: 'Abbott', category: 'Vitamin/Supplement', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'AFTER_FOOD', days: 30 },
    { brandName: 'Shelcal', genericName: 'Calcium + Vitamin D3', strength: '500mg', form: 'TABLET', company: 'Torrent', category: 'Vitamin/Supplement', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'AFTER_FOOD', days: 30 },
    { brandName: 'Neurobion Forte', genericName: 'Vitamin B Complex', strength: null, form: 'TABLET', company: 'Merck', category: 'Vitamin/Supplement', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'AFTER_FOOD', days: 30 },
    { brandName: 'Limcee', genericName: 'Vitamin C', strength: '500mg', form: 'TABLET', company: 'Abbott', category: 'Vitamin/Supplement', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'AFTER_FOOD', days: 15 },
    { brandName: 'Ondem', genericName: 'Ondansetron', strength: '4mg', form: 'TABLET', company: 'Alkem', category: 'Antiemetic', dose: { m: 1, a: 0, e: 0, n: 0 }, food: 'ANYTIME', days: 3 },
    { brandName: 'Cremaffin', genericName: 'Liquid Paraffin + Milk of Magnesia', strength: null, form: 'SYRUP', company: 'Abbott', category: 'Laxative', dose: { m: 0, a: 0, e: 0, n: 1 }, food: 'ANYTIME', days: 5 },
    { brandName: 'Sinarest Nasal Drops', genericName: 'Xylometazoline', strength: '0.1%', form: 'DROPS', company: 'Centaur', category: 'Decongestant', dose: { m: 1, a: 0, e: 0, n: 1 }, food: 'ANYTIME', days: 3 },
  ] as const;

  for (const med of demoMedicines) {
    await prisma.medicine.upsert({
      where: { id: `demo-medicine-${med.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
      update: {},
      create: {
        id: `demo-medicine-${med.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        brandName: med.brandName,
        genericName: med.genericName,
        strength: med.strength ?? undefined,
        form: med.form,
        company: med.company,
        category: med.category,
        defaultMorning: med.dose.m,
        defaultAfternoon: med.dose.a,
        defaultEvening: med.dose.e,
        defaultNight: med.dose.n,
        defaultBeforeAfterFood: med.food,
        defaultDurationDays: med.days,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete: admin/admin123, doctor/doctor123, ${demoPatients.length} demo patients, ${demoMedicines.length} demo medicines`,
  );
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
