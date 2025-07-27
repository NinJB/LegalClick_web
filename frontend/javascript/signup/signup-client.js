const signup = Vue.createApp({
  data() {
    return {
      currentStep: 1,
      totalSteps: 4,
      password: '',
      passwordRules: {
        uppercase: false,
        lowercase: false,
        number: false,
        specialChar: false,
        minLength: false,
      },
    };
  },
  computed: {
    passwordValidationList() {
      return [
        {
          label: 'At least 1 uppercase letter',
          valid: this.passwordRules.uppercase,
        },
        {
          label: 'At least 1 lowercase letter',
          valid: this.passwordRules.lowercase,
        },
        {
          label: 'At least 1 number',
          valid: this.passwordRules.number,
        },
        {
          label: 'At least 1 special character',
          valid: this.passwordRules.specialChar,
        },
        {
          label: 'Minimum 8 characters',
          valid: this.passwordRules.minLength,
        },
      ];
    },
  },
  template: `
    <div class="signup__container">
      <div class="step-indicator">
        <div v-for="n in totalSteps" :key="n" :class="['step', { active: currentStep >= n }]">{{ n }}</div>
      </div>

      <form id="signupForm" enctype="multipart/form-data" method="POST">
        <div v-show="currentStep === 1" class="form-step" ref="step1">
          <h2>Client Registration</h2>
          <h4>Personal Information</h4>

          <label for="first_name"><span>*</span>First Name <span>Required</span></label>
          <input type="text" id="first_name" name="first_name" required>

          <label for="last_name"><span>*</span>Last Name <span>Required</span></label>
          <input type="text" id="last_name" name="last_name" required>

          <label for="birth_date"><span>*</span>Birthdate <span>Required</span></label>
          <input type="date" id="birth_date" name="birth_date" required>

          <label for="age"><span>*</span>Age <span>Required</span></label>
          <input type="number" id="age" name="age" min="0" required>

          <label for="gender"><span>*</span>Gender <span>Required</span></label>
          <select id="gender" name="gender" required>
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div v-show="currentStep === 2" class="form-step" ref="step2">
          <h4>Contact Information</h4>

          <label for="address"><span>*</span>Address <span>Required</span></label>
          <input type="text" id="address" name="address" required>

          <label for="email"><span>*</span>Email <span>Required</span></label>
          <input type="email" id="email" name="email" required>

          <label for="contact_number"><span>*</span>Contact Number <span>Required</span></label>
          <input type="text" id="contact_number" name="contact_number" required>

          <label for="marital_status"><span>*</span>Marital Status <span>Required</span></label>
          <select id="marital_status" name="marital_status" required>
            <option value="">Select status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>

        <div v-show="currentStep === 3" class="form-step" ref="step3">
          <h4>Validation & Account Setup</h4>

          <label for="national_id"><span>*</span>National ID (Image Upload) <span>Required</span></label>
          <input type="file" id="national_id" name="national_id" accept="image/*" required>

          <label for="username"><span>*</span>Username <span>Required</span></label>
          <input type="text" id="username" name="username" required>

          <label for="password"><span>*</span>Password <span>Required</span></label>
          <input type="password" id="password" name="password" v-model="password" @input="validatePassword" required>

          <ul class="password-rules">
            <li v-for="rule in passwordValidationList" :class="{ valid: rule.valid, invalid: !rule.valid }">
              {{ rule.label }}
            </li>
          </ul>
        </div>

        <div v-show="currentStep === 4" class="form-step">
          <h4>Confirmation</h4>
          <p>Please review your details before submitting the registration.</p>
        </div>

        <div class="navigation-buttons">
          <button type="button" @click="prevStep" v-if="currentStep > 1">Back</button>
          <button type="button" @click="nextStep" v-if="currentStep < totalSteps">Next</button>
          <button type="submit" v-if="currentStep === totalSteps">Register</button>
        </div>
      </form>

    </div>

    <a href="/signup.html"><button class="homepage__back-button">Back</button></a>
  `,
  methods: {
    nextStep() {
      const stepFields = this.$refs[`step${this.currentStep}`].querySelectorAll('input, select');
      let isValid = true;

      stepFields.forEach((field) => {
        if (!field.checkValidity()) {
          isValid = false;
          field.reportValidity();
        }
      });

      if (isValid) {
        this.currentStep++;
      } else {
        alert("Please fill in all the required fields before proceeding.");
      }
    },
    prevStep() {
      if (this.currentStep > 1) this.currentStep--;
    },
    validatePassword() {
      const pwd = this.password;
      this.passwordRules.uppercase = /[A-Z]/.test(pwd);
      this.passwordRules.lowercase = /[a-z]/.test(pwd);
      this.passwordRules.number = /[0-9]/.test(pwd);
      this.passwordRules.specialChar = /[^A-Za-z0-9]/.test(pwd);
      this.passwordRules.minLength = pwd.length >= 8;
    },
  },
  mounted() {
    const form = document.getElementById('signupForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);

      try {
        const res = await fetch(`${window.API_BASE_URL}/signup-clients`, {
          method: 'POST',
          body: formData,
        });

        const result = await res.json();

        if (res.ok) {
          alert('Account created. You can now log in.');
          form.reset();
          this.password = '';
          this.currentStep = 1;
        } else {
          alert(result.message || 'Registration failed.');
        }
      } catch (err) {
        console.error('Registration error:', err);
        alert('An error occurred while submitting the form.');
      }
    });
  },
});

signup.mount('.signup');
