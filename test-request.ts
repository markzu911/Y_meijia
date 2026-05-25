import axios from 'axios';

async function main() {
  try {
    const res = await axios.post('http://localhost:3000/api/generate-video', {
      prompt: "test",
      imageBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4AWP4AACwAQABH9n7wAAAABJRU5ErkJggg=="
    });
    console.log(res.status, res.data);
  } catch (e: any) {
    console.error(e.response?.status, e.response?.data);
  }
}
main();
