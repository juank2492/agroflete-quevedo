import bcrypt from 'bcryptjs';
import type { PasswordHasher } from '../../../core/ports/services.js';

const ROUNDS = 12;

export const bcryptHasher: PasswordHasher = {
  hash: (plain) => bcrypt.hash(plain, ROUNDS),
  compare: (plain, hash) => bcrypt.compare(plain, hash),
};
