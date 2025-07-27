const calendarLawyerApp = Vue.createApp({
    data() {
        const today = new Date();
        return {
            selectedDate: null,
            selectedYear: today.getFullYear(),
            selectedMonth: today.getMonth(),
            appointments: {},
            lawyerId: null,
            loading: false,
            error: null,
            rescheduleModal: false,
            rescheduleConsultation: null,
            rescheduleDate: '',
            rescheduleTime: '',
            rescheduleClientName: '',
            rescheduleCategory: '',
            rescheduleDescription: '',
            rescheduleConsultationId: null,
            rescheduleLoading: false,
            rescheduleError: null,
            rescheduleOriginalDate: '',
            rescheduleOriginalTime: '',
            lawyerAvailability: null,
            minRescheduleDate: '',
            validRescheduleTimes: [],
        };
    },
    computed: {
        formattedDate() {
            return this.selectedDate ? this.formatDisplayDate(this.selectedDate) : 'Select a date';
        },
        dailyAppointments() {
            return this.appointments[this.selectedDate] || [];
        },
        consultationsThisMonth() {
            // Count all appointments in the current selected month and year
            const year = this.selectedYear;
            const month = this.selectedMonth + 1; // JS months are 0-based
            let count = 0;
            for (const dateStr in this.appointments) {
                const [dYear, dMonth] = dateStr.split('-');
                if (parseInt(dYear) === year && parseInt(dMonth) === month) {
                    count += this.appointments[dateStr].length;
                }
            }
            return count;
        },
        months() {
            return [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
        },
        years() {
            const currentYear = new Date().getFullYear();
            return Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
        },
        daysOfWeek() {
            return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        },
        daysInMonthGrid() {
            const year = this.selectedYear;
            const month = this.selectedMonth;
            const firstDay = new Date(year, month, 1).getDay();
            const totalDays = new Date(year, month + 1, 0).getDate();
            const grid = [];
            for (let i = 0; i < firstDay; i++) {
                grid.push(null);
            }
            for (let day = 1; day <= totalDays; day++) {
                const paddedDay = String(day).padStart(2, '0');
                const paddedMonth = String(month + 1).padStart(2, '0');
                const fullDate = `${year}-${paddedMonth}-${paddedDay}`;
                grid.push(fullDate);
            }
            return grid;
        },
        daysWithAppointments() {
            return new Set(Object.keys(this.appointments));
        }
    },
    methods: {
        formatDisplayDate(dateStr) {
            if (!dateStr) return '';
            const [year, month, day] = dateStr.split('-');
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
        },
        formatDisplayTime(timeStr) {
            if (!timeStr) return '';
            const [hour, minute] = timeStr.split(':');
            const d = new Date();
            d.setHours(parseInt(hour, 10));
            d.setMinutes(parseInt(minute, 10));
            d.setSeconds(0);
            return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        },
        selectDate(date) {
            if (date) this.selectedDate = date;
        },
        updateCalendar() {
            this.selectedDate = null;
        },
        async fetchAppointments() {
            this.loading = true;
            this.error = null;
            try {
                // Decode JWT from sessionStorage
                const token = sessionStorage.getItem('jwt');
                let lawyerId = null;
                if (token) {
                  const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
                  lawyerId = payload && payload.role_id;
                }
                this.lawyerId = lawyerId;
                if (!this.lawyerId) {
                    this.error = "Missing lawyer ID in token.";
                    this.loading = false;
                    return;
                }
                const baseUrl = window.API_BASE_URL;
                const res = await fetch(`${baseUrl}/consultations?lawyer_id=${this.lawyerId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
                if (!res.ok) throw new Error('Failed to load consultations');
                const consultations = await res.json();
                const upcoming = consultations.filter(c => c.consultation_status === 'Upcoming');
                // Fetch client names for each consultation
                const clientIds = [...new Set(upcoming.map(c => c.client_id))];
                const clientPromises = clientIds.map(id => fetch(`${baseUrl}/clients/${id}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }));
                const clientResponses = await Promise.all(clientPromises);
                const clients = {};
                for (let i = 0; i < clientIds.length; i++) {
                    if (clientResponses[i].ok) {
                        const client = await clientResponses[i].json();
                        clients[clientIds[i]] = client;
                    }
                }
                // Build appointments object
                const appts = {};
                for (const c of upcoming) {
                    let date = c.consultation_date;
                    if (date) {
                        const d = new Date(date);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        date = `${year}-${month}-${day}`;
                    }
                    if (!date) continue;
                    // Format time as 12-hour with AM/PM for display
                    let displayTime = c.consultation_time || '';
                    if (displayTime.length >= 5) {
                        let [hour, minute] = displayTime.split(":");
                        let d = new Date();
                        d.setHours(parseInt(hour, 10));
                        d.setMinutes(parseInt(minute, 10));
                        d.setSeconds(0);
                        displayTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    }
                    const client = clients[c.client_id];
                    const clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'Unknown';
                    const title = `Consultation with ${clientName}`;
                    if (!appts[date]) appts[date] = [];
                    appts[date].push({
                        consultation_id: c.consultation_id,
                        consultation_category: c.consultation_category,
                        consultation_description: c.consultation_description,
                        consultation_date: c.consultation_date, // original
                        consultation_time: c.consultation_time, // original
                        displayTime, // formatted for display
                        clientName,
                        title
                    });
                }
                this.appointments = appts;
            } catch (err) {
                console.error('Failed to fetch ongoing consultations:', err);
                this.error = 'Failed to load appointments.';
            } finally {
                this.loading = false;
            }
        },
        async openRescheduleModal(consultation) {
            this.rescheduleConsultation = consultation;
            this.rescheduleConsultationId = consultation.consultation_id || consultation.id;
            this.rescheduleClientName = consultation.clientName || consultation.title?.replace('Consultation with ', '') || '';
            this.rescheduleCategory = consultation.consultation_category || '';
            this.rescheduleDescription = consultation.consultation_description || '';
            this.rescheduleDate = '';
            this.rescheduleTime = '';
            // Display the date as-is for the modal
            let dateStr = consultation.consultation_date;
            let d = null;
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [year, month, day] = dateStr.split('-').map(Number);
                d = new Date(year, month - 1, day);
            } else if (dateStr) {
                d = new Date(dateStr);
            }
            if (d && !isNaN(d.getTime())) {
                const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                this.rescheduleOriginalDate = `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
            } else {
                this.rescheduleOriginalDate = 'N/A';
            }
            this.rescheduleOriginalTime = this.formatDisplayTime(consultation.consultation_time);
            // Set min date to today + 3 days
            const today = new Date();
            today.setDate(today.getDate() + 3);
            this.minRescheduleDate = today.toISOString().split('T')[0];
            // Fetch lawyer availability
            this.lawyerAvailability = null;
            this.validRescheduleTimes = [];
            try {
                const baseUrl = window.API_BASE_URL;
                const res = await fetch(`${baseUrl}/lawyer_availability/${this.lawyerId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
                if (res.ok) {
                    this.lawyerAvailability = await res.json();
                    this.validRescheduleTimes = this.generateValidTimes(this.lawyerAvailability);
                }
            } catch (e) {
                this.lawyerAvailability = null;
                this.validRescheduleTimes = [];
            }
            this.rescheduleModal = true;
            this.rescheduleError = null;
        },
        generateValidTimes(availability) {
            // Returns array of time strings ("HH:MM") in 30-min increments within morning and evening hours
            if (!availability) return [];
            const times = [];
            function addTimes(start, end) {
                if (!start || !end) return;
                let [sh, sm] = start.split(":").map(Number);
                let [eh, em] = end.split(":").map(Number);
                let d = new Date();
                d.setHours(sh, sm, 0, 0);
                const endD = new Date();
                endD.setHours(eh, em, 0, 0);
                while (d <= endD) {
                    times.push(d.toTimeString().slice(0,5));
                    d.setMinutes(d.getMinutes() + 30);
                }
            }
            addTimes(availability.morning_start, availability.morning_end);
            addTimes(availability.evening_start, availability.evening_end);
            return times;
        },
        closeRescheduleModal() {
            this.rescheduleModal = false;
            this.rescheduleConsultation = null;
            this.rescheduleError = null;
        },
        async submitReschedule() {
            this.rescheduleLoading = true;
            this.rescheduleError = null;
            // Validate date
            if (this.rescheduleDate < this.minRescheduleDate) {
                this.rescheduleError = `Date must be at least 3 days from today.`;
                this.rescheduleLoading = false;
                return;
            }
            // Validate time
            if (!this.validRescheduleTimes.includes(this.rescheduleTime)) {
                this.rescheduleError = `Time must be within your office hours.`;
                this.rescheduleLoading = false;
                return;
            }
            try {
                const baseUrl = window.API_BASE_URL;
                const res = await fetch(`${baseUrl}/consultations-reschedule/${this.rescheduleConsultationId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
                    body: JSON.stringify({
                        consultation_date: this.rescheduleDate,
                        consultation_time: this.rescheduleTime
                    })
                });
                if (!res.ok) throw new Error('Failed to reschedule');
                this.closeRescheduleModal();
                await this.fetchAppointments();
            } catch (err) {
                this.rescheduleError = err.message || 'Failed to reschedule';
            } finally {
                this.rescheduleLoading = false;
            }
        }
    },
    async mounted() {
        await this.fetchAppointments();
    },
    template: `
      <div class="calendar__container fadeInUp">
        <div class="calendar__panel" style="position:relative;">
          <div class="calendar__controls">
            <select v-model.number="selectedMonth" @change="updateCalendar">
              <option v-for="(month, i) in months" :value="i">{{ month }}</option>
            </select>
            <select v-model.number="selectedYear" @change="updateCalendar">
              <option v-for="year in years" :value="year">{{ year }}</option>
            </select>
          </div>
          <div class="calendar__weekdays">
            <span v-for="day in daysOfWeek" class="weekday">{{ day }}</span>
          </div>
          <div class="calendar__grid">
            <button 
              v-for="day in daysInMonthGrid" 
              :key="day || Math.random()" 
              class="calendar__day"
              :class="{ active: day === selectedDate && day, 'has-appointment': day && daysWithAppointments.has(day) }"
              @click="selectDate(day)"
              :disabled="!day"
            >
              {{ day ? day.split('-')[2] : '' }}
            </button>
          </div>
          <div class="consultations-count-lowerleft">
            Consultations this Month: {{ consultationsThisMonth }}
          </div>
        </div>
        <div class="calendar__card">
          <h4>{{ formattedDate }}</h4>
          <ul v-if="dailyAppointments.length">
            <li v-for="appt in dailyAppointments" :key="appt.consultation_id">
              <div class="appointment-info">
                <strong>{{ appt.displayTime }}</strong>: {{ appt.title }}
              </div>
              <div class="reschedule-btn-container">
                <button class="reschedule-btn" @click="openRescheduleModal(appt)">Reschedule</button>
              </div>
            </li>
          </ul>
          <p v-else>No appointments.</p>
          <div v-if="loading" style="margin-top:10px; color:#b22222;">Loading...</div>
          <div v-if="error" style="margin-top:10px; color:#b22222;">{{ error }}</div>
        </div>
      </div>
      <div v-if="rescheduleModal" class="modal-overlay" @click.self="closeRescheduleModal">
        <div class="reschedule-modal-content">
          <button class="modal-close" @click="closeRescheduleModal">&times;</button>
          <h3>Reschedule Consultation</h3>
          <p><strong>Client:</strong> {{ rescheduleClientName }}</p>
          <p><strong>Category:</strong> {{ rescheduleCategory }}</p>
          <p><strong>Description:</strong> {{ rescheduleDescription }}</p>
          <p><strong>Original Date:</strong> {{ rescheduleOriginalDate }}</p>
          <p><strong>Original Time:</strong> {{ rescheduleOriginalTime }}</p>
          <label>New Date:</label>
          <input type="date" v-model="rescheduleDate" :min="minRescheduleDate" />
          <label>New Time:</label>
          <select v-model="rescheduleTime">
            <option value="" disabled>Select time</option>
            <option v-for="t in validRescheduleTimes" :key="t" :value="t">{{ formatDisplayTime(t) }}</option>
          </select>
          <div v-if="rescheduleError" class="reschedule-error">{{ rescheduleError }}</div>
          <div class="reschedule-modal-actions">
            <button @click="submitReschedule" :disabled="rescheduleLoading" class="review-modal-submit">Save</button>
            <button @click="closeRescheduleModal" class="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
      <style>
        .appointment-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          margin-bottom: 12px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          padding: 10px 14px;
          display: flex;
          align-items: center;
        }
        .appointment-card-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        .reschedule-btn.small {
          font-size: 12px;
          padding: 3px 10px;
          border-radius: 4px;
          background: #f5a623;
          color: #fff;
          border: none;
          cursor: pointer;
          margin-left: 10px;
        }
        .reschedule-btn.small:hover {
          background: #e5941a;
        }
        .consultations-count-lowerleft {
          position: absolute;
          left: 10px;
          bottom: 10px;
          font-weight: bold;
          color: #f5a623;
          font-size: 1.1em;
          background: rgba(255,255,255,0.95);
          padding: 4px 12px;
          border-radius: 6px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          z-index: 2;
        }
      </style>
    `
});

calendarLawyerApp.mount('.calendar');
