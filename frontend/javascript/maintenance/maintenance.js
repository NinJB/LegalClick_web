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
              <th>Username</th><th>Name</th><th>Email</th><th>Contact</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in roleAdmins" :key="a.admin_id">
              <td>
                <span v-if="!a.isEditing">{{ a.username }}</span>
                <input v-else v-model="a.editForm.username" class="edit-input" />
              </td>
              <td>
                <span v-if="!a.isEditing">{{ a.first_name }} {{ a.last_name }}</span>
                <div v-else class="name-inputs">
                  <input v-model="a.editForm.first_name" class="edit-input" placeholder="First Name" />
                  <input v-model="a.editForm.last_name" class="edit-input" placeholder="Last Name" />
                </div>
              </td>
              <td>
                <span v-if="!a.isEditing">{{ a.email }}</span>
                <input v-else v-model="a.editForm.email" type="email" class="edit-input" />
              </td>
              <td>
                <span v-if="!a.isEditing">{{ a.contact_number }}</span>
                <input v-else v-model="a.editForm.contact_number" class="edit-input" />
              </td>
              <td>Activated</td>
              <td>
                <button v-if="!a.isEditing" @click="startEdit(a)" class="edit-btn">Edit</button>
                <div v-else class="action-buttons">
                  <button @click="saveEdit(a)" class="save-btn">Save</button>
                  <button @click="cancelEdit(a)" class="cancel-btn">Cancel</button>
                </div>
              </td>
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
      console.log('JWT payload:', payload);
      console.log('Extracted roleId:', roleId);
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
        console.log('Fetching admins with roleId:', this.roleId);
        const res = await fetch(`${window.API_BASE_URL}/admins/by-role/${this.roleId}`, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') } });
        
        if (!res.ok) {
          console.error('Failed to fetch admins:', res.status, res.statusText);
          return;
        }
        
        const admins = await res.json();
        console.log('Fetched admins:', admins);
        
        // Add editing state to each admin
        this.roleAdmins = admins.map(admin => ({
          ...admin,
          isEditing: false,
          editForm: {
            username: admin.username,
            first_name: admin.first_name,
            last_name: admin.last_name,
            email: admin.email,
            contact_number: admin.contact_number
          }
        }));
        
        console.log('Processed roleAdmins:', this.roleAdmins);
      } catch (error) {
        console.error('Error fetching admins:', error);
      }
    },
    startEdit(admin) {
      admin.isEditing = true;
      // Reset edit form to current values
      admin.editForm = {
        username: admin.username,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        contact_number: admin.contact_number
      };
    },
    async saveEdit(admin) {
      try {
        const response = await fetch(`${window.API_BASE_URL}/admin/update/${admin.admin_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('jwt') },
          body: JSON.stringify(admin.editForm)
        });
        
        if (response.ok) {
          // Update the admin data with the new values
          Object.assign(admin, admin.editForm);
          admin.isEditing = false;
          alert('Admin updated successfully');
        } else {
          alert('Failed to update admin');
        }
      } catch (error) {
        console.error('Error updating admin:', error);
        alert('Error updating admin');
      }
    },
    cancelEdit(admin) {
      admin.isEditing = false;
      // Reset edit form to original values
      admin.editForm = {
        username: admin.username,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        contact_number: admin.contact_number
      };
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

// Add CSS styles for the edit functionality
const style = document.createElement('style');
style.textContent = `
.edit-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.name-inputs {
  display: flex;
  gap: 4px;
}

.name-inputs .edit-input {
  flex: 1;
}

.edit-btn, .save-btn, .cancel-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin: 0 2px;
}

.edit-btn {
  background-color: #007bff;
  color: white;
}

.save-btn {
  background-color: #28a745;
  color: white;
}

.cancel-btn {
  background-color: #dc3545;
  color: white;
}

.edit-btn:hover {
  background-color: #0056b3;
}

.save-btn:hover {
  background-color: #218838;
}

.cancel-btn:hover {
  background-color: #c82333;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

table td {
  vertical-align: middle;
}
`;
document.head.appendChild(style);
