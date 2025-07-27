const calendarApp = Vue.createApp({
    data() {
        const today = new Date();
        return {
            selectedDate: null,
            selectedYear: today.getFullYear(),
            selectedMonth: today.getMonth()
        };
    },
    computed: {
        formattedDate() {
            return this.selectedDate ? this.formatDisplayDate(this.selectedDate) : 'Select a date';
        },
        dailyAppointments() {
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
        formatDisplayDate(dateStr) {
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
        },
        updateCalendar() {
            this.selectedDate = null;
        },
        // Dummy fetch for demonstration; replace with real fetch if needed
        async fetchOngoingConsultations() {
            // Decode JWT from sessionStorage (future-proofing)
            let roleId = null;
            const token = sessionStorage.getItem('jwt');
            if (token) {
              const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
              roleId = payload && payload.role_id;
            }
            // Example: populate appointments with correct date and time formatting
            // Replace this with your real fetch logic as needed
            // If you ever fetch, add Authorization header:
            // const res = await fetch('your-api-url', { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
            const appts = {
                '2025-07-20': [{ time: '01:00 PM', title: 'Consultation with Atty. Example' }],
                '2025-07-21': [{ time: '10:30 AM', title: 'Client Meeting' }]
            };
            this.appointments = appts;
        }
    },
    async mounted() {
        await this.fetchOngoingConsultations();
    },
    template: `
      <div class="calendar__container fadeInUp">
        <div class="calendar__panel">
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
