const signup = Vue.createApp({
  data() {
    return {
      currentStep: 1,
      totalSteps: 3,
      password: '',
      confirmPassword: '',
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
        { label: 'At least 1 uppercase letter', valid: this.passwordRules.uppercase },
        { label: 'At least 1 lowercase letter', valid: this.passwordRules.lowercase },
        { label: 'At least 1 number', valid: this.passwordRules.number },
        { label: 'At least 1 special character', valid: this.passwordRules.specialChar },
        { label: 'Minimum 8 characters', valid: this.passwordRules.minLength },
      ];
    },
  },
  methods: {
    validatePassword() {
      const pwd = this.password;
      this.passwordRules.uppercase = /[A-Z]/.test(pwd);
      this.passwordRules.lowercase = /[a-z]/.test(pwd);
      this.passwordRules.number = /[0-9]/.test(pwd);
      this.passwordRules.specialChar = /[^A-Za-z0-9]/.test(pwd);
      this.passwordRules.minLength = pwd.length >= 8;
    },
    nextStep() {
      const stepFields = this.$refs[`step${this.currentStep}`].querySelectorAll('input');
      let isValid = true;
      stepFields.forEach((field) => {
        if (!field.checkValidity()) {
          field.reportValidity();
          isValid = false;
        }
      });
      if (isValid) this.currentStep++;
    },
    prevStep() {
      if (this.currentStep > 1) this.currentStep--;
    },
    async submitForm(e) {
      e.preventDefault();

      const allValid = Object.values(this.passwordRules).every(v => v);
      if (!allValid) {
        return alert('Password does not meet all criteria.');
      }

      if (this.password !== this.confirmPassword) {
        return alert("Passwords do not match.");
      }

      const form = e.target;
      const formData = new FormData(form);

      try {
        const res = await fetch(`${window.API_BASE_URL}/signup-secretary`, {
          method: 'POST',
          body: formData,
        });

        const result = await res.json();
        if (res.ok) {
          alert("Secretary account created successfully.");
          // Redirect to the signup page (refresh or navigate)
          window.location.href = '/html/secretary/signup.html';
        } else {
          alert(result.message || 'Signup failed.');
        }
      } catch (err) {
        console.error(err);
        alert("An error occurred.");
      }
    },
  },
  template: `
    <div class="signup__container">
      <div class="step-indicator">
        <div v-for="n in totalSteps" :key="n" :class="['step', { active: currentStep >= n }]">{{ n }}</div>
      </div>

      <form id="signupForm" @submit="submitForm">
        <!-- Step 1: Personal Information -->
        <div v-show="currentStep === 1" ref="step1" class="form-section step-wrapper">
          <h3>Personal Information</h3>
          <label for="first_name" class="form-label"><span class="required">*</span>First Name <span>Required</span></label>
          <input id="first_name" name="first_name" required placeholder="First Name" class="form-input" />

          <label for="last_name" class="form-label"><span class="required">*</span>Last Name  <span>Required</span></label>
          <input id="last_name" name="last_name" required placeholder="Last Name" class="form-input" />
        </div>

        <!-- Step 2: Contact Information -->
        <div v-show="currentStep === 2" ref="step2" class="form-section step-wrapper">
          <h3>Contact Information</h3>
          <label for="email" class="form-label"><span class="required">*</span>Email <span>Required</span></label>
          <input id="email" type="email" name="email" required placeholder="Email" class="form-input" />

          <label for="contact_number" class="form-label"><span class="required">*</span>Contact Number <span>Required</span></label>
          <input id="contact_number" name="contact_number" required placeholder="Contact Number" class="form-input" />

          <label for="address" class="form-label"><span class="required">*</span>Address <span>Required</span></label>
          <input id="address" name="address" required placeholder="Address" class="form-input" />
        </div>

        <!-- Step 3: Account Details -->
        <div v-show="currentStep === 3" ref="step3" class="form-section step-wrapper">
          <h3>Account Details</h3>
          <label for="username" class="form-label"><span class="required">*</span>Username <span>Required</span></label>
          <input id="username" name="username" required placeholder="Username" class="form-input" />

          <label for="password" class="form-label"><span class="required">*</span>Password  <span>Required</span></label>
          <input id="password" type="password" name="password" v-model="password" @input="validatePassword" required placeholder="Password" class="form-input" />

          <label for="confirm_password" class="form-label"><span class="required">*</span>Confirm Password  <span>Required</span></label>
          <input id="confirm_password" type="password" v-model="confirmPassword" required placeholder="Confirm Password" class="form-input" />

          <ul class="password-rules">
            <li v-for="rule in passwordValidationList" :class="{ valid: rule.valid }">{{ rule.label }}</li>
          </ul>
        </div>

        <!-- Navigation Buttons -->
        <div class="navigation-buttons">
          <button type="button" @click="prevStep" v-if="currentStep > 1" class="btn-back">Back</button>
          <button type="button" @click="nextStep" v-if="currentStep < totalSteps" class="btn-next">Next</button>
          <button type="submit" v-if="currentStep === totalSteps" class="btn-submit">Register</button>
        </div>
      </form>
    </div>

    <a href="/signup.html"><button class="homepage__back-button">Back</button></a>
  `,
});

signup.mount('.signup');
