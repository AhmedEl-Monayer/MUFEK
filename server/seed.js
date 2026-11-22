import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, nowIso, run, setSetting, syncDb } from './db.js';
import { encryptNationalId, hashNationalId, hashPassword } from './security.js';
import { UPLOAD_DIR } from './config.js';

const demo = process.argv.includes('--demo');
const now = nowIso();
const day = 24 * 60 * 60 * 1000;
const fromNow = (ms) => new Date(Date.now() + ms).toISOString();

async function createUser({ username, nationalId, password, role, fullName, phone, completed = 0 }) {
  const existing = get('SELECT * FROM users WHERE lower(username) = lower(?)', username);
  if (existing) return existing;
  const info = run(
    `INSERT INTO users(username, national_id_enc, national_id_hash, password_hash, role, full_name, phone,
      is_active, must_change_password, profile_completed, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    username, encryptNationalId(nationalId), hashNationalId(nationalId), await hashPassword(password),
    role, fullName, phone || '', completed, now, now
  );
  return get('SELECT * FROM users WHERE id = ?', Number(info.lastInsertRowid));
}

function makePdf(title) {
  const safe = String(title).replace(/[^\x20-\x7E]/g, '?').replace(/[()\\]/g, '');
  const stream = `BT /F1 16 Tf 50 780 Td (${safe}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

function writeDemoPdf(folder, name, title) {
  const filePath = path.join(UPLOAD_DIR, folder, name);
  fs.writeFileSync(filePath, makePdf(title));
  return { file: name, size: fs.statSync(filePath).size, mime: 'application/pdf' };
}

export async function seedBase() {
  setSetting('platform_name', 'منصة هندسة المنوفية');
  setSetting('faculty_name', 'كلية الهندسة');
  setSetting('university_name', 'جامعة المنوفية');
  setSetting('support_email', 'support@eng.menofia.edu.eg');
  setSetting('reminder_hours', '24');
  setSetting('default_allow_late', '0');
  setSetting('allow_student_leave', '1');

  const dev = await createUser({
    username: process.env.DEVELOPER_USERNAME || 'developer',
    nationalId: process.env.DEVELOPER_NATIONAL_ID || '30001011234567',
    password: process.env.DEVELOPER_PASSWORD || 'Admin@12345',
    role: 'developer',
    fullName: process.env.DEVELOPER_NAME || 'مسؤول المنصة',
    phone: process.env.DEVELOPER_PHONE || '01000000000',
    completed: 1
  });
  console.log(`Developer account ready: ${dev.username}`);
}

export async function seedDemo() {
  if (get("SELECT id FROM users WHERE username = 'dr.ahmed'")) {
    console.log('Demo data already exists — skipping.');
    return;
  }

  const doctor1 = await createUser({
    username: 'dr.ahmed', nationalId: '31002021234567', password: 'Doctor@123', role: 'doctor',
    fullName: 'د. أحمد منصور', phone: '01011112222', completed: 1
  });
  const doctor2 = await createUser({
    username: 'dr.hala', nationalId: '31003031234567', password: 'Doctor@123', role: 'doctor',
    fullName: 'د. هالة فؤاد', phone: '01011113333', completed: 1
  });
  const mona = await createUser({
    username: 'ta.mona', nationalId: '31504041234567', password: 'Ta@123456', role: 'ta',
    fullName: 'م. منة الله سامي', phone: '01022223333', completed: 1
  });
  const karim = await createUser({
    username: 'ta.karim', nationalId: '31505051234567', password: 'Ta@123456', role: 'ta',
    fullName: 'م. كريم عادل', phone: '01022224444', completed: 1
  });
  const nour = await createUser({
    username: 'ta.nour', nationalId: '31506061234567', password: 'Ta@123456', role: 'ta',
    fullName: 'م. نور الدين', phone: '01022225555', completed: 1
  });
  const omar = await createUser({
    username: 'omar', nationalId: '32007071234567', password: 'Student@123', role: 'student',
    fullName: 'عمر خالد', phone: '01133334444', completed: 1
  });
  const sara = await createUser({
    username: 'sara', nationalId: '32008081234567', password: 'Student@123', role: 'student',
    fullName: 'سارة إبراهيم', phone: '01133335555', completed: 1
  });
  const yousef = await createUser({
    username: 'yousef', nationalId: '32009091234567', password: 'Student@123', role: 'student',
    fullName: 'يوسف حسن', phone: '01133336666', completed: 1
  });
  const mariam = await createUser({
    username: 'mariam', nationalId: '32010101234567', password: 'Student@123', role: 'student',
    fullName: 'مريم عادل', phone: '01133337777', completed: 1
  });
  const ziad = await createUser({
    username: 'ziad', nationalId: '32011111234567', password: 'Student@123', role: 'student',
    fullName: 'زياد طارق', phone: '01133338888', completed: 1
  });

  const course = (name, code, description, doctorId) => {
    const info = run(
      'INSERT INTO courses(name, code, description, doctor_id, is_active, created_at, updated_at) VALUES(?, ?, ?, ?, 1, ?, ?)',
      name, code, description, doctorId, now, now
    );
    const id = Number(info.lastInsertRowid);
    run("INSERT INTO chats(course_id, type, write_mode, is_locked, created_at) VALUES(?, 'general', 'all', 0, ?)", id, now);
    return get('SELECT * FROM courses WHERE id = ?', id);
  };
  const statics = course('الاستاتيكا', 'CIV201', 'أساسيات الميكانيكا الهندسية وتحليل القوى والمقاطع.', doctor1.id);
  const fluids = course('ميكانيكا الموائع', 'MEC202', 'خصائص الموائع والسريان والضغط وتطبيقاتها الهندسية.', doctor2.id);
  const math = course('الرياضيات الهندسية', 'MTH101', 'التفاضل والتكامل والمعادلات التفاضلية للتطبيقات الهندسية.', doctor1.id);

  const addTa = (courseRow, ta, dayName, time, room, general = false) => {
    run(
      `INSERT INTO course_tas(course_id, ta_id, section_day, section_time, section_room, can_create_assignments, can_post_general, added_at)
       VALUES(?, ?, ?, ?, ?, 1, ?, ?)`,
      courseRow.id, ta.id, dayName, time, room, general ? 1 : 0, now
    );
    const info = run("INSERT INTO chats(course_id, type, ta_id, write_mode, is_locked, created_at) VALUES(?, 'ta', ?, 'all', 0, ?)", courseRow.id, ta.id, now);
    return get('SELECT * FROM chats WHERE id = ?', Number(info.lastInsertRowid));
  };
  const monaChat = addTa(statics, mona, 'السبت', '10:00 ص - 12:00 م', 'قاعة 12');
  const karimChat = addTa(statics, karim, 'الأحد', '12:00 م - 2:00 م', 'قاعة 7');
  addTa(fluids, nour, 'الثلاثاء', '9:00 ص - 11:00 ص', 'معمل 3');
  addTa(math, mona, 'الأربعاء', '11:00 ص - 1:00 م', 'قاعة 5', true);

  const join = (courseRow, student) => {
    run('INSERT INTO course_students(course_id, student_id, joined_at) VALUES(?, ?, ?)', courseRow.id, student.id, now);
  };
  [omar, sara, yousef, mariam].forEach((s) => join(statics, s));
  [omar, sara, ziad].forEach((s) => join(fluids, s));
  [mariam, ziad].forEach((s) => join(math, s));

  const request = (chat, student, status) => {
    run(
      'INSERT INTO chat_requests(chat_id, student_id, status, created_at, decided_at, decided_by) VALUES(?, ?, ?, ?, ?, ?)',
      chat.id, student.id, status, fromNow(-2 * day), status === 'pending' ? null : fromNow(-day), chat.ta_id
    );
  };
  request(monaChat, omar, 'approved');
  request(monaChat, sara, 'pending');
  request(karimChat, yousef, 'approved');
  request(monaChat, mariam, 'pending');
  const nourChat = get("SELECT * FROM chats WHERE course_id = ? AND type = 'ta'", fluids.id);
  request(nourChat, sara, 'approved');
  request(nourChat, omar, 'pending');

  const message = (chat, sender, body, minutesAgo) => {
    run('INSERT INTO messages(chat_id, sender_id, body, created_at) VALUES(?, ?, ?, ?)', chat.id, sender.id, body, fromNow(-minutesAgo * 60000));
  };
  const staticsGeneral = get("SELECT * FROM chats WHERE course_id = ? AND type = 'general'", statics.id);
  const fluidsGeneral = get("SELECT * FROM chats WHERE course_id = ? AND type = 'general'", fluids.id);
  message(staticsGeneral, doctor1, 'أهلاً بكم في مادة الاستاتيكا. سيتم رفع ملازم المحاضرات هنا.', 3000);
  message(staticsGeneral, mona, 'من فضلكم راجعوا الفصل الأول قبل السكشن القادم.', 2500);
  message(staticsGeneral, omar, 'هل يوجد حل لمسألة ٤ في الشيت؟', 1400);
  message(staticsGeneral, doctor1, 'سنراجعها معاً في المحاضرة القادمة إن شاء الله.', 1200);
  message(fluidsGeneral, doctor2, 'تقرير الموائع مطلوب تسليمه قبل نهاية الأسبوع.', 900);
  message(monaChat, mona, 'مرحباً عمر، هذه مساحة سكشن السبت. أي استفسار اكتبه هنا.', 1800);
  message(monaChat, omar, 'شكراً يا هندسة، هل الشيت الجديد متاح؟', 1500);
  message(monaChat, mona, 'نعم، تم نشره في صفحة التكليفات.', 1450);
  message(karimChat, karim, 'أهلاً يوسف، موعد سكشننا الأحد الساعة ١٢.', 700);
  message(nourChat, nour, 'تذكير: تسليم تقرير الموائع قبل الموعد.', 600);

  const createAssignment = (courseRow, options) => {
    const info = run(
      `INSERT INTO assignments(course_id, scope, ta_id, created_by, title, description, file, file_name, file_size, file_mime,
        published_at, due_at, allow_late, max_grade, is_active, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      courseRow.id, options.scope, options.taId || null, options.createdBy, options.title, options.description || '',
      options.file || null, options.fileName || null, options.fileSize || null, options.fileMime || null,
      fromNow(-3 * day), options.dueAt, options.allowLate ? 1 : 0, options.maxGrade || null, now, now
    );
    return get('SELECT * FROM assignments WHERE id = ?', Number(info.lastInsertRowid));
  };
  const assignmentFile = writeDemoPdf('assignments', 'demo-assignment-statics.pdf', 'Statics Assignment 1');
  const a1 = createAssignment(statics, {
    scope: 'general', createdBy: doctor1.id, title: 'واجب الاستاتيكا الأول',
    description: 'حل مسائل الفصل الأول والثاني مع رسم مخططات الجسم الحر. يُرفع الحل بصيغة PDF.',
    dueAt: fromNow(5 * day), allowLate: false, maxGrade: 20,
    file: assignmentFile.file, fileName: 'واجب الاستاتيكا الأول.pdf', fileSize: assignmentFile.size, fileMime: assignmentFile.mime
  });
  createAssignment(statics, {
    scope: 'ta', taId: mona.id, createdBy: mona.id, title: 'تكليف سكشن أ - منة الله',
    description: 'تكليف خاص بطلاب شات المعيد. حل التمارين ١ إلى ٥.', dueAt: fromNow(2 * day), allowLate: true, maxGrade: 10
  });
  createAssignment(statics, {
    scope: 'ta', taId: karim.id, createdBy: karim.id, title: 'تكليف سكشن ب - كريم',
    description: 'مسائل اتزان القوى المستوية.', dueAt: fromNow(7 * day), allowLate: false, maxGrade: 10
  });
  const fluidsFile = writeDemoPdf('assignments', 'demo-assignment-fluids.pdf', 'Fluids Report');
  createAssignment(fluids, {
    scope: 'general', createdBy: doctor2.id, title: 'تقرير ميكانيكا الموائع',
    description: 'تقرير عن تطبيقات معادلة برنولي في الشبكات الهيدروليكية.',
    dueAt: fromNow(1 * day), allowLate: true, maxGrade: 15,
    file: fluidsFile.file, fileName: 'تقرير الموائع.pdf', fileSize: fluidsFile.size, fileMime: fluidsFile.mime
  });

  const submission = writeDemoPdf('submissions', 'demo-solution-omar.pdf', 'Omar Solution');
  run(
    `INSERT INTO submissions(assignment_id, student_id, file, file_name, file_size, file_mime, submitted_at, is_late, status)
     VALUES(?, ?, ?, ?, ?, ?, ?, 0, 'submitted')`,
    a1.id, omar.id, submission.file, 'حل واجب الاستاتيكا.pdf', submission.size, submission.mime, fromNow(-6 * 60 * 60 * 1000)
  );
  const saraSolution = writeDemoPdf('submissions', 'demo-solution-sara.pdf', 'Sara Report');
  const fluidsAssignment = get("SELECT * FROM assignments WHERE course_id = ? AND scope = 'general'", fluids.id);
  run(
    `INSERT INTO submissions(assignment_id, student_id, file, file_name, file_size, file_mime, submitted_at, is_late, status, grade, feedback, reviewed_by, reviewed_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, 0, 'graded', 13, 'تقرير جيد، مع ملاحظة إضافة المراجع.', ?, ?)`,
    fluidsAssignment.id, sara.id, saraSolution.file, 'تقرير سارة.pdf', saraSolution.size, saraSolution.mime,
    fromNow(-10 * 60 * 60 * 1000), doctor2.id, fromNow(-5 * 60 * 60 * 1000)
  );

  const notify = (userId, type, title, body, link, isRead = 0) => {
    run(
      'INSERT INTO notifications(user_id, type, title, body, link, is_read, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)',
      userId, type, title, body, link, isRead, fromNow(-60 * 60 * 1000)
    );
  };
  notify(omar.id, 'assignment_new', 'تكليف جديد', 'تم نشر واجب الاستاتيكا الأول', `/assignment/${a1.id}`);
  notify(mona.id, 'join_request', 'طلب انضمام جديد', 'سارة إبراهيم تطلب الانضمام إلى شاتك', '/ta/requests');
  notify(doctor1.id, 'submission_new', 'تسليم جديد', 'عمر خالد سلّم واجب الاستاتيكا الأول', `/assignment/${a1.id}`);
  notify(sara.id, 'submission_review', 'تم تصحيح تكليفك', 'تقرير الموائع - الدرجة: 13', `/assignment/${fluidsAssignment.id}`, 1);

  console.log('Demo data seeded successfully.');
  console.log('Accounts: dr.ahmed / Doctor@123, ta.mona / Ta@123456, omar / Student@123');
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  await seedBase();
  if (demo) await seedDemo();
  syncDb();
  console.log('Seed complete.');
}
