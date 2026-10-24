import { parse, readJson, route } from "@/server/http";
import { sendOtp } from "@/server/otp";
import { clientIp } from "@/server/rate-limit";
import { otpSendSchema } from "@/server/validation";

/** Sends the code; signing in with it goes through Auth.js (provider "phone-otp"). */
export const POST = route(async (req) => {
  const { phone } = parse(otpSendSchema, await readJson(req));
  return Response.json(await sendOtp(phone, clientIp(req)));
});
