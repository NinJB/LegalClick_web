const lawyer_requests = Vue.createApp({
  data() {
    return {
      requests: [],
      filteredStatus: null,
      lawyerId: null,
      showModal: false,
      selectedRequest: null,
      modalType: '' // 'remove', 'approve', or 'reject'
    };
  },
  computed: {
    filteredRequests() {
      if (!this.filteredStatus) return this.requests;
      return this.requests.filter(r => r.work_status === this.filteredStatus);
    }
  },
  mounted() {
    // Decode JWT from sessionStorage
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      this.lawyerId = null;
    } else {
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      this.lawyerId = payload && payload.role_id;
    }
    this.fetchRequests();
    document.addEventListener('keydown', this.handleEscape);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape);
  },
  methods: {
    async fetchRequests() {
      try {
        const baseUrl = window.API_BASE_URL;
        const response = await fetch(`${baseUrl}/lawyer/${this.lawyerId}/requests`, {
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        const data = await response.json();
        this.requests = data;
      } catch (error) {
        console.error('Error fetching requests:', error);
      }
    },
    getProfilePicture(picture) {
      return picture || '/images/temporary-profile.jpg';
    },
    setFilter(status) {
      this.filteredStatus = status;
    },
    confirmAction(request, type) {
      this.selectedRequest = request;
      this.modalType = type; // 'remove', 'approve', 'reject'
      this.showModal = true;
    },
    async proceedAction() {
      let method = 'PUT';
      let body = null;
      let url = `${window.API_BASE_URL}/secretary/requests/${this.selectedRequest.work_id}`;

      if (this.modalType === 'remove') {
        method = 'DELETE';
      } else if (this.modalType === 'approve') {
        body = JSON.stringify({ status: 'Approved' });
      } else if (this.modalType === 'reject') {
        body = JSON.stringify({ status: 'Rejected' });
      }

      try {
        const response = await fetch(url, {
          method,
          headers: method !== 'DELETE' ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } : { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body
        });

        if (response.ok) {
          if (this.modalType === 'remove') {
            this.requests = this.requests.filter(r => r.work_id !== this.selectedRequest.work_id);
          } else {
            this.selectedRequest.work_status = this.modalType === 'approve' ? 'Approved' : 'Rejected';
          }
        } else {
          console.error('Action failed.');
        }
      } catch (error) {
        console.error('Error performing action:', error);
      } finally {
        this.showModal = false;
        this.selectedRequest = null;
        this.modalType = '';
      }
    },
    cancelAction() {
      this.showModal = false;
      this.selectedRequest = null;
      this.modalType = '';
    },
    handleEscape(event) {
      if (event.key === 'Escape' && this.showModal) {
        this.cancelAction();
      }
    }
  },
  template: `
    <div class="requests-list">
      <h2 class="title">Secretary List</h2>
      <div class="filters">
        <button @click="setFilter(null)">All</button>
        <button @click="setFilter('Pending')">Pending</button>
        <button @click="setFilter('Approved')">Approved</button>
        <button @click="setFilter('Rejected')">Rejected</button>
      </div>
      <div class="scroll-container">
        <ul v-if="filteredRequests.length" class="request-items">
          <li v-for="request in filteredRequests" :key="request.work_id" class="request-card">
            <img :src="getProfilePicture(request.profile_picture)" alt="Profile" class="profile-pic" />
            <div class="info">
              <h3>{{ request.first_name }} {{ request.last_name }}</h3>
              <p>Status: <strong>{{ request.work_status }}</strong></p>
            </div>
            <div class="button">
              <template v-if="request.work_status === 'Pending'">
                <button @click="confirmAction(request, 'approve')" class="button approve">Approve</button>
                <button @click="confirmAction(request, 'reject')" class="button reject">Reject</button>
              </template>
              <template v-else>
                <button @click="confirmAction(request, 'remove')" class="button remove">Remove</button>
              </template>
            </div>
          </li>
        </ul>
        <div v-else class="empty-state" style="text-align:center; padding: 20px;">
          <img src="/images/hammer.png" alt="Nothing to see here" class="nothing-image"/>
          <p class="nothing">Nothing to see here yet.</p>
        </div>
      </div>

      <!-- Confirmation Modal -->
      <div v-if="showModal" class="modal-overlay">
        <div class="modal">
            <img
            :src="modalType === 'approve' 
                    ? '/images/check-mark.png' 
                    : modalType === 'remove' 
                        ? '/images/delete-mark.png' 
                        : '/images/delete-mark.png'"
            class="remove-attorney"
            />
            
            <h2 v-if="modalType === 'remove'">
            Are you sure you want to remove {{ selectedRequest.first_name }} {{ selectedRequest.last_name }}?
            </h2>
            <h2 v-else-if="modalType === 'approve'">
            Approve secretary request from {{ selectedRequest.first_name }} {{ selectedRequest.last_name }}?
            </h2>
            <h2 v-else-if="modalType === 'reject'">
            Reject secretary request from {{ selectedRequest.first_name }} {{ selectedRequest.last_name }}?
            </h2>
            
            <div class="modal-buttons">
            <button @click="proceedAction" class="button approve">Yes, Confirm</button>
            <button @click="cancelAction" class="button reject">Cancel</button>
            </div>
        </div>
        </div>
    </div>
  `
});

lawyer_requests.mount('.lawyers');
