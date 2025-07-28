const FreeConsultationForm = {
  data() {
    return {
      form: {
        lawyer_id: '',
        client_id: '',
        consultation_category: '',
        consultation_description: '',
        consultation_date: '',
        consultation_time: '',
        consultation_duration: '1',
        consultation_fee: 0, // Free consultation - fixed at 0
        consultation_mode: 'In-Person', // Default to In-Person
        payment_mode: 'Over the Counter' // Hidden but stored in database
      },
      specializations: [],
      lawyerInfo: null,
      availableTimes: [] // Will be populated with restricted times
    };
  },
  methods: {
    async fetchLawyerInfo() {
      const urlParams = new URLSearchParams(window.location.search);
      const lawyerId = urlParams.get('lawyer_id');
      
      if (!lawyerId) {
        alert('Missing lawyer ID.');
        return;
      }

      try {
        const baseUrl = window.API_BASE_URL;
        const response = await fetch(`${baseUrl}/lawyers/${lawyerId}`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        
        if (response.ok) {
          this.lawyerInfo = await response.json();
        }
      } catch (error) {
        console.error('Error fetching lawyer info:', error);
      }
    },
    generateAvailableTimes() {
      // Generate time slots from 8AM to 12PM and 1PM to 5PM
      const times = [];
      
      // Morning slots: 8AM to 12PM
      for (let hour = 8; hour <= 12; hour++) {
        times.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour !== 12) { // Don't add :30 for 12PM
          times.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }
      
      // Afternoon slots: 1PM to 5PM
      for (let hour = 13; hour <= 17; hour++) {
        times.push(`${hour.toString().padStart(2, '0')}:00`);
        if (hour !== 17) { // Don't add :30 for 5PM
          times.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }
      
      this.availableTimes = times;
    },
    async submitForm() {
      if (!this.form.consultation_category || !this.form.consultation_description || 
          !this.form.consultation_date || !this.form.consultation_time) {
        alert('Please fill in all required fields.');
        return;
      }

      const formData = new FormData();
      formData.append('client_id', this.form.client_id);
      formData.append('lawyer_id', this.form.lawyer_id);
      formData.append('consultation_category', this.form.consultation_category);
      formData.append('consultation_description', this.form.consultation_description);
      formData.append('consultation_date', this.form.consultation_date);
      formData.append('consultation_time', this.form.consultation_time);
      formData.append('consultation_duration', this.form.consultation_duration);
      formData.append('consultation_fee', this.form.consultation_fee);
      formData.append('consultation_mode', this.form.consultation_mode);
      formData.append('payment_mode', this.form.payment_mode);

      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/consultation`, {
          method: 'POST',
          body: formData,
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        
        if (res.ok) {
          alert('Free consultation request submitted successfully.');
          window.location.href = `/html/client/search.html`;
        } else {
          alert('Submission failed.');
        }
      } catch (error) {
        console.error(error);
        alert('Network or server error during submission.');
      }
    }
  },
  async mounted() {
    // Generate available time slots
    this.generateAvailableTimes();
    
    // Fetch specializations first
    try {
      const baseUrl = window.API_BASE_URL;
      const specRes = await fetch(`${baseUrl}/specializations`, { 
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } 
      });
      if (!specRes.ok) throw new Error('Failed to load specializations');
      this.specializations = await specRes.json();
    } catch (e) {
      console.error(e);
      alert('Failed to load consultation categories.');
    }

    // Decode JWT from sessionStorage for client_id
    const token = sessionStorage.getItem('jwt');
    let clientId = null;
    if (token) {
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      clientId = payload && payload.role_id;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const lawyerId = urlParams.get('lawyer_id');
    const isFree = urlParams.get('free') === '1';

    if (!lawyerId || !clientId) {
      alert('Missing lawyer or client ID.');
      return;
    }

    if (!isFree) {
      alert('This form is for free consultations only.');
      return;
    }

    this.form.lawyer_id = lawyerId;
    this.form.client_id = clientId;
    this.form.consultation_fee = 0; // Free consultation - fixed
    this.form.consultation_mode = 'In-Person'; // Default to In-Person
    this.form.payment_mode = 'Over the Counter'; // Hidden but stored

    await this.fetchLawyerInfo();
  },
  template: `
    <div class="consultation-form">
      <h2>Free Consultation Request</h2>
      <div v-if="lawyerInfo" class="lawyer-info">
        <p><strong>Requesting consultation with:</strong> Atty. {{ lawyerInfo.first_name }} {{ lawyerInfo.last_name }}</p>
        <p><strong>Category:</strong> {{ lawyerInfo.attorney_category }}</p>
      </div>
      
      <form @submit.prevent="submitForm">
        <div class="form-group">
          <label>Consultation Category *</label>
          <select v-model="form.consultation_category" required>
            <option value="">Select Category</option>
            <option v-for="spec in specializations" :key="spec.specialization_id" :value="spec.name">
              {{ spec.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Description *</label>
          <textarea v-model="form.consultation_description" placeholder="Describe your legal issue..." required></textarea>
        </div>

        <div class="form-group">
          <label>Date *</label>
          <input type="date" v-model="form.consultation_date" required>
        </div>

        <div class="form-group">
          <label>Time *</label>
          <select v-model="form.consultation_time" required>
            <option value="">Select Time</option>
            <option v-for="time in availableTimes" :key="time" :value="time">
              {{ time }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Duration</label>
          <select v-model="form.consultation_duration">
            <option value="1">1 hour</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
          </select>
        </div>

        <div class="form-group">
          <label>Mode</label>
          <select v-model="form.consultation_mode" disabled>
            <option value="In-Person">In-Person</option>
          </select>
        </div>

        <div class="form-group">
          <label>Fee</label>
          <input type="text" value="Free (₱0)" disabled>
        </div>

        <button type="submit">Submit Free Consultation Request</button>
      </form>
    </div>
  `
};

// Mount the component if we're on the form page
if (document.querySelector('.consultation-form')) {
  Vue.createApp(FreeConsultationForm).mount('.consultation-form');
}
