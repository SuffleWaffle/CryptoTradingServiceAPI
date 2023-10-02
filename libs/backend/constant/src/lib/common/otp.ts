// generate OTP code for send in email and test user, length 4 symbols
export function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
