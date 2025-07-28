// Check if this is a free consultation
const urlParams = new URLSearchParams(window.location.search);
const isFree = urlParams.get('free') === '1';

// Get lawyer_id from sessionStorage (set by search page)
const lawyerId = sessionStorage.getItem('selectedLawyerId');

if (isFree) {
  // Load the free consultation form instead
  const script = document.createElement('script');
  script.src = '/javascript/consultation_form/free_ consultation.js';
  document.head.appendChild(script);
  // Remove lawyerId from sessionStorage for security
  sessionStorage.removeItem('selectedLawyerId');
} else {
  // Load the regular consultation form
  const ConsultationForm = {
  template: `
    <div class="slip-container" v-if="lawyer && client">
      <h2>Consultation Form</h2>
      <p><strong>Atty.</strong> {{ lawyer.first_name }} {{ lawyer.last_name }}<br>
      <em>{{ lawyer.attorney_category }} Lawyer</em></p>
      
      <p><strong>Name of Client:</strong> {{ client.first_name }} {{ client.last_name }}</p>
      <p><strong>Date:</strong> {{ today }}</p>

      <form @submit.prevent="submitForm" class="form-slip">
        <label>*Consultation Category: <span>Required</span>
          <select v-model="form.consultation_category" required>
            <option disabled value="">Select</option>
            <option
              v-for="spec in specializations"
              :key="spec.specialization_id"
              :value="spec.name"
            >
              {{ spec.name }}
            </option>
          </select>
        </label>

        <label>*Consultation Description: <span>Required</span>
          <textarea v-model="form.consultation_description" required></textarea>
        </label>

        <label>*Consultation Date: <span>Required</span>
          <input type="date" v-model="form.consultation_date" :min="minConsultationDate" :max="maxConsultationDate" required>
        </label>

        <label>*Consultation Time: <span>Required</span>
          <input type="time" v-model="form.consultation_time" :min="timeStart" :max="timeEnd" required>
        </label>

        <label>*Consultation Duration (hours): <span>Required</span>
          <input type="number" min="1" v-model.number="form.consultation_duration" @input="calculateFee" required>
        </label>

        <label>*Total Amount Due (₱): <span>Required</span>
          <input type="text" :value="form.consultation_fee" readonly>
        </label>

        <label>*Consultation Mode: <span>Required</span>
          <select v-model="form.consultation_mode" @change="updatePaymentMode" required>
            <option disabled value="">Select</option>
            <option>Online</option>
            <option>In-Person</option>
          </select>
        </label>

        <label>*Payment Mode: <span>Required</span>
          <select v-model="form.payment_mode" required>
            <option disabled value="">Select</option>
            <option v-if="form.consultation_mode === 'Online'">GCash</option>
            <option v-if="form.consultation_mode === 'In-Person'">GCash</option>
            <option v-if="form.consultation_mode === 'In-Person'">Over the Counter</option>
          </select>
        </label>
        
        <a :href="'/html/client/search.html?role_id=' + encodeURIComponent(this.form.client_id)">
          <button type="button">Back</button>
        </a>

        <button type="submit">Submit</button>
      </form>
    </div>
  `,
  data() {
    return {
      lawyer: null,
      client: null,
      today: new Date().toISOString().split("T")[0],
      minConsultationDate: '',
      maxConsultationDate: '',
      timeStart: '',
      timeEnd: '',
      service: {},
      specializations: [],  // <-- new: to hold fetched specializations
      form: {
        lawyer_id: '',
        client_id: '',
        consultation_category: '',
        consultation_description: '',
        consultation_date: '',
        consultation_time: '',
        consultation_duration: 1,
        consultation_mode: '',
        consultation_fee: 0,
        payment_mode: '',
        consultation_status: 'Pending',
      },
    };
  },
  async mounted() {
    // Fetch all specializations and the lawyer's specializations
    try {
      const baseUrl = window.API_BASE_URL;
      const [specRes, lawyerSpecRes] = await Promise.all([
        fetch(`${baseUrl}/specializations`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }),
        fetch(`${baseUrl}/lawyer/${lawyerId}/specializations`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
      ]);
      if (!specRes.ok || !lawyerSpecRes.ok) throw new Error('Failed to load specializations');
      const allSpecs = await specRes.json();
      const lawyerSpecIds = await lawyerSpecRes.json();
      // Only show specializations the lawyer has
      this.specializations = allSpecs.filter(spec => lawyerSpecIds.includes(spec.specialization_id));
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
    if (!lawyerId || !clientId) {
      alert('Missing lawyer or client ID.');
      return;
    }
    this.form.lawyer_id = lawyerId;
    this.form.client_id = clientId;
    // Remove lawyerId from sessionStorage for security
    sessionStorage.removeItem('selectedLawyerId');
    try {
      const baseUrl = window.API_BASE_URL;
      const [lawyerRes, clientRes, availabilityRes, servicesRes] = await Promise.all([
        fetch(`${baseUrl}/lawyers/${lawyerId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }),
        fetch(`${baseUrl}/clients/${clientId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }),
        fetch(`${baseUrl}/lawyer_availability/${lawyerId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }),
        fetch(`${baseUrl}/lawyer_services/${lawyerId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
      ]);
      if (!lawyerRes.ok || !clientRes.ok || !availabilityRes.ok || !servicesRes.ok) {
        alert('Error loading consultation form data.');
        return;
      }
      this.lawyer = await lawyerRes.json();
      this.client = await clientRes.json();
      const availability = await availabilityRes.json();
      this.service = await servicesRes.json();
      const today = new Date();
      const minDate = new Date(today);
      minDate.setDate(today.getDate() + 3);
      this.minConsultationDate = minDate.toISOString().split("T")[0];
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + 30);
      this.maxConsultationDate = maxDate.toISOString().split("T")[0];
      this.timeStart = availability.morning_start;
      this.timeEnd = availability.evening_end;
      this.calculateFee();
    } catch (err) {
      console.error(err);
      alert('Unexpected error loading consultation form.');
    }
  },
  methods: {
    calculateFee() {
      const baseRate = this.service.consultation_fee || 0;
      this.form.consultation_fee = baseRate * this.form.consultation_duration;
    },
    updatePaymentMode() {
      if (this.form.consultation_mode === "Online") {
        this.form.payment_mode = "GCash";
      } else {
        this.form.payment_mode = "";
      }
    },
    async submitForm() {
      if (!this.form.consultation_fee || this.form.consultation_fee <= 0) {
        alert("Consultation fee is missing or zero. Please select a valid consultation duration.");
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
          alert('Consultation request submitted successfully.');
          window.location.href = `/html/client/search.html`;
        } else {
          alert('Submission failed.');
        }
      } catch (error) {
        console.error(error);
        alert('Network or server error during submission.');
      }
    }
  }
};

// Mount the component
const app = Vue.createApp(ConsultationForm);
app.mount('.form');
} // Close the else block
