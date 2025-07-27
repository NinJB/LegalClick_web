const messages = Vue.createApp({
    data() {
      return {
        contacts: [],
        currentContact: null,
        messages: [],
        messageText: '',
        loadingMessages: false
      };
    },
    methods: {
      async loadContacts() {
        const res = await axios.get('/api/contacts');
        this.contacts = res.data;
        if (this.contacts.length) this.currentContact = this.contacts[0];
      },
      async loadMessages() {
        if (!this.currentContact) return;
        this.loadingMessages = true;
        const res = await axios.get(`/api/messages?contactId=${this.currentContact.id}`);
        this.messages = res.data;
        this.loadingMessages = false;
      },
      async sendMessage() {
        if (!this.messageText.trim()) return;
        const newMessage = {
          contactId: this.currentContact.id,
          text: this.messageText,
          sender: 'me'
        };
        await axios.post('/api/messages', newMessage);
        this.messageText = '';
        await this.loadMessages();
      },
      selectContact(contact) {
        this.currentContact = contact;
        this.loadMessages();
      }
    },
    mounted() {
      this.loadContacts();
    }
  });
  
  messages.mount('.messages');
  