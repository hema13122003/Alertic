const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5001/projectalertic/us-central1/api' 
  : 'https://us-central1-projectalertic.cloudfunctions.net/api';

export default API_BASE_URL;
