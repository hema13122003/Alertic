const axios = require('axios');
async function testSave() {
  const data = {
    entries: [
      {
        dept: "Computer Science",
        section: "A",
        program: "B.Tech",
        semester: "4",
        academic_year: "2023-24",
        day: "Monday",
        period: 1,
        faculty_id: 4, // Exists
        subject_name: "Test Subject"
      }
    ]
  };
  try {
    const res = await axios.post('http://localhost:5000/api/timetable/batch', data);
    console.log('Success:', res.data);
  } catch (err) {
    console.log('Error:', err.response ? err.response.data : err.message);
  }
}
testSave();
