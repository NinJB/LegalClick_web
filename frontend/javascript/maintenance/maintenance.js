Vue.createApp({
  template: `
    <div>
      <!-- Buttons to switch forms -->
      <div>
        <button @click="activeForm = 'admin'"><img src="/images/add-admin.png" class="add">Add Admin</button>
        <button @click="activeForm = 'specialization'"><img src="/images/add-special.png" class="add">Add Specialization</button>
      </div>

      <!-- Admin Section -->
      <div v-if="activeForm === 'admin'">
        <h3>Admins with Same Role</h3>
        <button @click="showAdminModal = true" class="new">New Admin</button>
        <table>
          <thead>
            <tr>
              <th>Username</th><th>Name</th><th>Email</th><th>Contact</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in roleAdmins" :key="a.admin_id">
              <td>{{ a.username }}</td>
              <td>{{ a.first_name }} {{ a.last_name }}</td>
              <td>{{ a.email }}</td>
              <td>{{ a.contact_number }}</td>
              <td>Activated</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Admin Modal -->
      <div v-if="showAdminModal" class="modal-overlay" @click.self="showAdminModal = false">
        <div class="modal-content">
          <h3>Add Admin</h3>
          <form @submit.prevent="addAdmin">
            <input v-model="admin.username" placeholder="Username" required />
            <input v-model="admin.first_name" placeholder="First Name" required />
            <input v-model="admin.last_name" placeholder="Last Name" required />
            <input v-model="admin.email" type="email" placeholder="Email" required />
            <input v-model="admin.password" type="password" placeholder="Password" required />
            <input v-model="admin.contact_number" placeholder="Contact Number" required />
            <button type="submit">Submit</button>
            <button type="button" @click="showAdminModal = false">Cancel</button>
          </form>
        </div>
      </div>

      <!-- Specialization Section -->
      <div v-if="activeForm === 'specialization'">
        <h3>Specializations</h3>
        <button @click="showSpecializationModal = true" class="new">New Specialization</button>

        <ul>
          <li v-for="spec in specializations" :key="spec.specialization_id">
            {{ spec.specialization_name }}
            <button @click="removeSpecialization(spec.specialization_id)" class="remove">Remove</button>
          </li>
        </ul>
      </div>

      <!-- Specialization Modal -->
      <div v-if="showSpecializationModal" class="modal-overlay" @click.self="showSpecializationModal = false">
        <div class="modal-content">
          <h3>Add Specialization</h3>
          <form @submit.prevent="addSpecialization">
            <input v-model="specialization_name" placeholder="Specialization Name" required />
            <button type="submit">Submit</button>
            <button type="button" @click="showSpecializationModal = false">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
  data() {
    // Decode JWT from sessionStorage
    let roleId = null;
    const token = sessionStorage.getItem('jwt');
    if (token) {
      const payload = window.decodeJWT ? window.decodeJWT(token) : JSON.parse(atob(token.split('.')[1]));
      roleId = payload && payload.role_id;
    }
    return {
      activeForm: 'admin',
      showAdminModal: false,
      showSpecializationModal: false,
      admin: {
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        contact_number: ''
      },
      roleAdmins: [],
      specialization_name: '',
      specializationMessage: '',
      specializations: [],
      roleId: roleId
    };
  },
  methods: {
    async addAdmin() {
      try {
        const response = await fetch(`${window.API_BASE_URL}/add-admin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify({ ...this.admin, role_id: this.roleId })
        });
        const result = await response.json();
        alert(result.message);
        if (result.success) {
          this.admin = {
            username: '',
            first_name: '',
            last_name: '',
            email: '',
            password: '',
            contact_number: ''
          };
          this.getRoleAdmins();
          this.showAdminModal = false;
        }
      } catch (error) {
        console.error('Error adding admin:', error);
      }
    },
    async getRoleAdmins() {
      try {
        const res = await fetch(`${window.API_BASE_URL}/admins/role/${this.roleId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
        this.roleAdmins = await res.json();
      } catch (error) {
        console.error('Error fetching admins:', error);
      }
    },
    async addSpecialization() {
      try {
        const res = await fetch(`${window.API_BASE_URL}/add-specializations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify({ specialization_name: this.specialization_name })
        });
        const result = await res.json();
        this.specializationMessage = result.message;
        if (result.success) {
          this.specialization_name = '';
          this.getSpecializations();
          this.showSpecializationModal = false;
        }
      } catch (error) {
        console.error('Error adding specialization:', error);
      }
    },
    async getSpecializations() {
      try {
        const baseUrl = window.API_BASE_URL;
        const res = await fetch(`${baseUrl}/view-specializations`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
        this.specializations = await res.json();
      } catch (error) {
        console.error('Error fetching specializations:', error);
      }
    },
    async removeSpecialization(id) {
      try {
        await fetch(`${window.API_BASE_URL}/delete-specializations/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') }
        });
        this.getSpecializations();
      } catch (error) {
        console.error('Error deleting specialization:', error);
      }
    }
  },
  mounted() {
    this.getRoleAdmins();
    this.getSpecializations();
  }
}).mount('.maintenance');
