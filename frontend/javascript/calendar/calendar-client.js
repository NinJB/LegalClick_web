const calendarApp = Vue.createApp({
    data() {
        const today = new Date();
        return {
            selectedDate: null,
            selectedYear: today.getFullYear(),
            selectedMonth: today.getMonth(),
            appointments: {
                '2025-05-03': [{ time: '10:00 AM', title: 'Client Meeting' }],
                '2025-05-05': [{ time: '1:00 PM', title: 'Consultation with Atty. Cruz' }]
            }
        };
    },
    computed: {
        formattedDate() {
            // Use the selectedDate string directly, format for display
            return this.selectedDate ? this.formatDisplayDate(this.selectedDate) : 'Select a date';
        },
        dailyAppointments() {
            // Always use the same format as the keys in appointments
            if (!this.selectedDate) return [];
            return this.appointments[this.selectedDate] || [];
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
        formatYMD(dateObj) {
            // Always returns YYYY-MM-DD in local time
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        formatDisplayDate(dateStr) {
            // Expects 'YYYY-MM-DD', returns 'Month DD, YYYY'
            if (!dateStr) return '';
            const [year, month, day] = dateStr.split('-');
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            return `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
        },
        selectDate(date) {
            if (date) this.selectedDate = date;
            console.log('Selected date:', this.selectedDate);
        },
        updateCalendar() {
            this.selectedDate = null;
        },
        onMonthChange(e) {
            this.selectedMonth = parseInt(e.target.value, 10);
            this.updateCalendar();
        },
        onYearChange(e) {
            this.selectedYear = parseInt(e.target.value, 10);
            this.updateCalendar();
        },
        async fetchOngoingConsultations() {
            // Decode JWT from sessionStorage
            const token = sessionStorage.getItem('jwt');
            let clientId = null;
            if (token) {
              const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
              clientId = payload && payload.role_id;
            }
            if (!clientId) return;
            try {
                const baseUrl = window.API_BASE_URL;
                const res = await fetch(`${baseUrl}/api/consultations?client_id=${clientId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
                if (!res.ok) throw new Error('Failed to load consultations');
                const consultations = await res.json();
                const upcoming = consultations.filter(c => c.consultation_status === 'Upcoming');
                const lawyerIds = [...new Set(upcoming.map(c => c.lawyer_id))];
                const lawyerPromises = lawyerIds.map(id => fetch(`${baseUrl}/api/lawyers/${id}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } }));
                const lawyerResponses = await Promise.all(lawyerPromises);
                const lawyers = {};
                for (let i = 0; i < lawyerIds.length; i++) {
                    if (lawyerResponses[i].ok) {
                        const lawyer = await lawyerResponses[i].json();
                        lawyers[lawyerIds[i]] = lawyer;
                    }
                }
                const appts = {};
                for (const c of upcoming) {
                    let date = c.consultation_date;
                    if (date) {
                        // Parse as UTC, convert to local, extract YYYY-MM-DD
                        const d = new Date(date);
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        date = `${year}-${month}-${day}`;
                    }
                    if (!date) continue;
                    // Format time as 12-hour with AM/PM
                    let time = c.consultation_time || '';
                    if (time.length >= 5) {
                        let [hour, minute] = time.split(":");
                        let d = new Date();
                        d.setHours(parseInt(hour, 10));
                        d.setMinutes(parseInt(minute, 10));
                        d.setSeconds(0);
                        time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    }
                    const lawyer = lawyers[c.lawyer_id];
                    const title = `Consultation with Atty. ${lawyer?.last_name || ''}`;
                    if (!appts[date]) appts[date] = [];
                    appts[date].push({ time, title });
                }
                this.appointments = appts;
            } catch (err) {
                console.error('Failed to fetch ongoing consultations:', err);
            }
        }
    },
    async mounted() {
        await this.fetchOngoingConsultations();
    },
    template: `
      <div class="calendar__container fadeInUp">
        <div class="calendar__panel">
          <div class="calendar__controls">
            <select v-model.number="selectedMonth" @change="onMonthChange">
              <option v-for="(month, i) in months" :value="i">{{ month }}</option>
            </select>
            <select v-model.number="selectedYear" @change="onYearChange">
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
        </div>
        <div class="calendar__card">
          <h4>{{ formattedDate }}</h4>
          <ul v-if="dailyAppointments.length">
            <li v-for="appt in dailyAppointments" :key="appt.time">
              <strong>{{ appt.time }}</strong>: {{ appt.title }}
            </li>
          </ul>
          <p v-else>No appointments.</p>
        </div>
      </div>
    `
});

calendarApp.mount('.calendar');
