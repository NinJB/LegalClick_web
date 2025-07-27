const lawyerManagement = Vue.createApp({
    data() {
        return {
        lawyers: [],
        selectedLawyer: null,
        activeFilter: 'Requests',
        searchQuery: '',
        consultations: [],
        logs: [],
        activeTab: 'profile'
        };
    },
    computed: {
        filteredLawyers() {
            const query = this.searchQuery.toLowerCase();

            let filtered = this.lawyers.filter(lawyer => {
                const rollNumber = lawyer.roll_number?.toString().toLowerCase() || '';
                const firstName = lawyer.first_name?.toLowerCase() || '';
                const lastName = lawyer.last_name?.toLowerCase() || '';

                return (
                    rollNumber.includes(query) ||
                    firstName.includes(query) ||
                    lastName.includes(query)
                );
            });

            if (this.activeFilter === 'Requests') {
                return filtered.filter(lawyer => lawyer.attorney_category === 'Public' && lawyer.account_status === 'Request');
            } else if (this.activeFilter === 'Activated') {
                return filtered.filter(lawyer => lawyer.attorney_category === 'Public' && lawyer.account_status === 'Activated');
            } else if (this.activeFilter === 'Rejected') {
                return filtered.filter(lawyer => lawyer.attorney_category === 'Public' && lawyer.account_status === 'Rejected');
            } else if (this.activeFilter === 'Deactivated') {
                return filtered.filter(lawyer => lawyer.attorney_category === 'Public' && lawyer.account_status === 'Deactivated');
            } else {
                return filtered;
            }
        },
        requestsCount() {
            return this.lawyers.filter(lawyer =>
                lawyer.account_status === 'Request' &&
                lawyer.attorney_category === 'Public'
            ).length;
        },
        activatedCount() {
            return this.lawyers.filter(lawyer =>
                lawyer.account_status === 'Activated' &&
                lawyer.attorney_category === 'Public'
            ).length;
        },
        rejectedCount() {
            return this.lawyers.filter(lawyer =>
                lawyer.account_status === 'Rejected' &&
                lawyer.attorney_category === 'Public'
            ).length;
        },
        deactivatedCount() {
            return this.lawyers.filter(lawyer =>
                lawyer.account_status === 'Deactivated' &&
                lawyer.attorney_category === 'Public'
            ).length;
        }
    },
    methods: {
        fetchLawyers() {
        const baseUrl = window.API_BASE_URL;
        fetch(`${baseUrl}/api/public-lawyers`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
            .then(response => response.json())
            .then(data => {
            this.lawyers = data;
            })
            .catch(error => {
            console.error('Error fetching lawyers:', error);
            });
        },
        viewLawyer(lawyer) {
            this.selectedLawyer = lawyer;
            this.activeTab = 'profile';
            this.fetchConsultations(lawyer.lawyer_id);
            this.fetchLogs(lawyer.lawyer_id);
        },
        fetchConsultations(lawyerId) {
            const baseUrl = window.API_BASE_URL;
            fetch(`${baseUrl}/api/lawyers/${lawyerId}/consultations`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
                .then(response => response.json())
                .then(data => {
                this.consultations = data;
                })
                .catch(error => {
                console.error('Error fetching consultations:', error);
                });
        },
        fetchLogs(lawyerId) {
            const baseUrl = window.API_BASE_URL;
            fetch(`${baseUrl}/api/lawyers/${lawyerId}/logs`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } })
                .then(response => response.json())
                .then(data => {
                this.logs = data;
                })
                .catch(error => {
                console.error('Error fetching logs:', error);
                });
        },
        closeModal() {
            this.selectedLawyer = null;
            this.consultations = [];
            this.logs = [];
        },
        async confirmLawyer(lawyerId) {
            await this.updateLawyerStatus(lawyerId, 'Activated');
            this.fetchLawyers();
            this.selectedLawyer = null;
        },
        async rejectLawyer(lawyerId) {
            await this.updateLawyerStatus(lawyerId, 'Rejected');
            this.fetchLawyers();
            this.selectedLawyer = null;
        },
        async deactivateLawyer(lawyerId) {
            await this.updateLawyerStatus(lawyerId, 'Deactivated');
            this.fetchLawyers();
            this.selectedLawyer = null;
        },
        async activateLawyer(lawyerId) {
            await this.updateLawyerStatus(lawyerId, 'Activated');
            this.fetchLawyers();
            this.selectedLawyer = null;
        },
        async updateLawyerStatus(lawyer_id, status) {
            if (!lawyer_id) {
                console.error('Invalid lawyer id');
                return;
            }
            const baseUrl = window.API_BASE_URL;
            await fetch(`${baseUrl}/public-lawyers/${lawyer_id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + sessionStorage.getItem('jwt')
                },
                body: JSON.stringify({ account_status: status }),
            });
        },
        setFilter(filter) {
            this.activeFilter = filter;
        }
    },
    mounted() {
        this.fetchLawyers();
    },
    template: `
        <div class="lawyer-management">
            <!-- Search bar -->
            <div class="search-bar">
                <input v-model="searchQuery" type="text" placeholder="Search by roll number, first name, or last name">
            </div>

            <!-- Filter buttons -->
            <div class="filter-buttons">
                <button :class="{ active: activeFilter === 'Requests' }" @click="setFilter('Requests')">
                    Requests ({{ requestsCount }})
                </button>
                <button :class="{ active: activeFilter === 'Activated' }" @click="setFilter('Activated')">
                    Activated ({{ activatedCount }})
                </button>
                <button :class="{ active: activeFilter === 'Rejected' }" @click="setFilter('Rejected')">
                    Rejected ({{ rejectedCount }})
                </button>
                <button :class="{ active: activeFilter === 'Deactivated' }" @click="setFilter('Deactivated')">
                    Deactivated ({{ deactivatedCount }})
                </button>
            </div>

            <!-- Lawyer Table -->
            <div class="lawyer-table">
                <table class="table table-bordered table-striped">
                    <thead>
                        <tr>
                            <th>Roll Number</th>
                            <th>First Name</th>
                            <th>Last Name</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="lawyer in filteredLawyers" :key="lawyer.lawyer_id">
                            <td>{{ lawyer.roll_number }}</td>
                            <td>{{ lawyer.first_name }}</td>
                            <td>{{ lawyer.last_name }}</td>
                            <td>{{ lawyer.account_status }}</td>
                            <td><button @click="viewLawyer(lawyer)" class="btn btn-primary">View</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Lawyer Detail Modal -->
            <div v-if="selectedLawyer" class="modal">
            <div class="modal-content">
                <!-- Tab Navigation -->
                <div class="tab-navigation">
                    <button :class="{ active: activeTab === 'profile' }" @click="activeTab = 'profile'">Profile</button>
                    <button :class="{ active: activeTab === 'transactions' }" @click="activeTab = 'transactions'">Transaction Trail</button>
                    <button :class="{ active: activeTab === 'logs' }" @click="activeTab = 'logs'">Log Trail</button>
                </div>

                <!-- Tab Content -->
                <div class="tab-content">
                <!-- Profile Tab -->
                <div v-if="activeTab === 'profile'">
                    <div class="lawyer-info">
                    
                    <div class="profile-lawyer-wrapper">
                        <img :src="selectedLawyer.profile_picture ? 'data:image/jpeg;base64,' + selectedLawyer.profile_picture : '/images/temporary-profile.jpg'" alt="Profile Picture" class="profile-img"/>
                    </div>

                    <h3><strong>Atty. {{ selectedLawyer.first_name }} {{ selectedLawyer.last_name }}</strong></h3>

                    <p><strong>Roll Number:</strong> {{ selectedLawyer.roll_number }}</p>
                    <p><strong>Username:</strong> {{ selectedLawyer.username }}</p>
                    <p><strong>Gender:</strong> {{ selectedLawyer.gender }}</p>
                    <p><strong>Bar Admission Year:</strong> {{ selectedLawyer.bar_admission_year }}</p>
                    <p><strong>Law School:</strong> {{ selectedLawyer.law_school }}</p>
                    <p><strong>Office Address:</strong> {{ selectedLawyer.office_address }}</p>
                    <p><strong>Email:</strong> {{ selectedLawyer.email }}</p>
                    <p><strong>Contact Number:</strong> {{ selectedLawyer.contact_number }}</p>
                    <p><strong>GCash Number:</strong> {{ selectedLawyer.gcash_number }}</p>
                    <p><strong>Attorney Category:</strong> {{ selectedLawyer.attorney_category }}</p>
                    </div>
                </div>

                <!-- Transaction Trail Tab -->
                <div v-if="activeTab === 'transactions'" class="transaction-log">
                    <h2>Transaction Trail</h2>
                    <table class="table table-bordered table-striped">
                    <thead>
                        <tr>
                        <th>Consultation ID</th>
                        <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="consultation in consultations" :key="consultation.consultation_id">
                        <td>{{ consultation.consultation_id }}</td>
                        <td>{{ consultation.consultation_status }}</td>
                        </tr>
                    </tbody>
                    </table>
                </div>

                <!-- Log Trail Tab -->
                <div v-if="activeTab === 'logs'" class="log-trail-log">
                    <h2>Log Trail</h2>
                    <table class="table table-bordered table-striped">
                    <thead>
                        <tr>
                        <th>Timestamp</th>
                        <th>Type</th>
                        <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="log in logs" :key="log.log_timestamp">
                        <td>{{ log.log_timestamp }}</td>
                        <td>{{ log.log_type }}</td>
                        <td>{{ log.log_status }}</td>
                        </tr>
                    </tbody>
                    </table>
                </div>
                </div>

                <!-- Modal Actions -->
                <div class="modal-actions">
                <button v-if="selectedLawyer.account_status === 'Request'" class="btn btn-success" @click="confirmLawyer(selectedLawyer.lawyer_id)">Confirm</button>
                <button v-if="selectedLawyer.account_status === 'Request'" class="btn btn-danger" @click="rejectLawyer(selectedLawyer.lawyer_id)">Reject</button>
                <button v-if="selectedLawyer.account_status === 'Activated'" class="btn btn-warning" @click="deactivateLawyer(selectedLawyer.lawyer_id)">Deactivate</button>
                <button v-if="selectedLawyer.account_status === 'Deactivated'" class="btn btn-success" @click="activateLawyer(selectedLawyer.lawyer_id)">Activate</button>
                <button class="btn btn-secondary" @click="closeModal">Close</button>
                </div>
            </div>
            </div>
        </div>
    `
});

lawyerManagement.mount('.lawyer-management');
