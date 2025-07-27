import { Client } from 'pg';

const client = new Client({
  host: process.env.DB_HOST || 'legalclick-db',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_secure_password',
  database: process.env.DB_NAME || 'legalclick',
  
});
export default client;