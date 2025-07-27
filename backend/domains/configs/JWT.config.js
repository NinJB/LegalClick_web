import jsonwebtoken from 'jsonwebtoken'
export const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

export const jwt = jsonwebtoken