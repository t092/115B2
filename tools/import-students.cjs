const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');

const [, , csvPath, serviceAccountPath] = process.argv;
if (!csvPath || !serviceAccountPath) {
  console.error('用法：node tools/import-students.cjs <CSV路徑> <Service Account JSON路徑>');
  process.exit(1);
}

const csv = fs.readFileSync(path.resolve(csvPath), 'utf8').replace(/^\uFEFF/, '');
const rows = csv.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const headers = rows.shift().split(',').map(value => value.trim());
const index = key => headers.indexOf(key);
const classIndex = index('班級');
const seatIndex = index('座號');
const nameIndex = index('姓名');
const emailIndex = index('Google學習帳號');

if ([classIndex, seatIndex, nameIndex, emailIndex].some(value => value < 0)) {
  throw new Error('CSV 欄位必須包含：班級、座號、姓名、Google學習帳號');
}

const students = rows.map(line => {
  const columns = line.split(',').map(value => value.trim());
  const email = columns[emailIndex].toLowerCase();
  return {
    id: email,
    class: columns[classIndex],
    seat: columns[seatIndex],
    name: columns[nameIndex],
    email
  };
}).filter(student => student.email);

const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), 'utf8'));
admin.initializeApp({credential: admin.credential.cert(serviceAccount)});
const db = admin.firestore();

(async () => {
  let batch = db.batch();
  let count = 0;
  for (const student of students) {
    const ref = db.collection('students').doc(student.id);
    batch.set(ref, {
      class: student.class,
      seat: student.seat,
      name: student.name,
      email: student.email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    count += 1;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log(`已匯入 ${count} 筆學習帳號至 students 集合。`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
