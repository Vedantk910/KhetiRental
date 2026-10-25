import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/toast";
import { renderIntl } from "@/lib/test-intl";
import { LoginForm } from "./login-form";

const push = vi.fn();
vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");
  return {
    usePathname: () => "/login",
    useRouter: () => ({ push, replace: vi.fn() }),
    Link: ({ href, children, ...r }: { href: string; children: React.ReactNode }) =>
      React.createElement("a", { href, ...r }, children),
  };
});

const fetchMock = vi.fn();
beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  sessionStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const view = (over: Partial<Parameters<typeof LoginForm>[0]> = {}) =>
  renderIntl(
    <ToastProvider>
      <LoginForm
        initialMode="login"
        initialRole="renter"
        next={null}
        google="mock"
        phoneLogin
        authFailed={false}
        {...over}
      />
    </ToastProvider>,
  );

describe("LoginForm", () => {
  it("without phone login there is no Mobile method, even if one was remembered", () => {
    sessionStorage.setItem("kr:login.method", JSON.stringify("mobile"));
    view({ phoneLogin: false });
    expect(screen.queryByRole("radio", { name: "Mobile number" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mobile number")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("login + mobile: invalid number shows the inline error and sends nothing", async () => {
    const user = userEvent.setup();
    view();
    await user.type(screen.getByLabelText("Mobile number"), "12345");
    await user.click(screen.getByRole("button", { name: "Send OTP" }));
    expect(screen.getByText("Enter a 10-digit mobile number.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile number")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts Devanagari digits, groups them, sends +91 and goes to the OTP page", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ resendAfterS: 30 }) });
    view({ next: "/en/bookings" });
    await user.type(screen.getByLabelText("Mobile number"), "९८७६५४३२१०");
    expect(screen.getByLabelText("Mobile number")).toHaveValue("98765 43210");
    await user.click(screen.getByRole("button", { name: "Send OTP" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/login/otp?next=%2Fen%2Fbookings");
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ phone: "+919876543210" });
    expect(JSON.parse(sessionStorage.getItem("kr:otp-pending")!)).toMatchObject({
      phone: "+919876543210",
      mode: "login",
    });
  });

  it("rate limit from the server shows the 10-minute copy", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ code: "rate_limited" }) });
    view();
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    await user.click(screen.getByRole("button", { name: "Send OTP" }));
    expect(await screen.findByText("Too many tries. Wait 10 minutes and try again.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("sign-up asks for a name and a role, owner chosen from ?role=owner", async () => {
    const user = userEvent.setup();
    view({ initialMode: "signup", initialRole: "owner" });
    expect(screen.getByRole("radio", { name: "List my machines" })).toHaveAttribute("aria-checked", "true");
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    await user.click(screen.getByRole("button", { name: "Send OTP" }));
    expect(screen.getByText("Enter your full name (2 to 80 letters).")).toBeInTheDocument();
  });

  it("email: the button reads Log in or Create account, password has a show/hide button", async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole("radio", { name: "Email" }));
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/login/forgot");
    const pw = screen.getByLabelText("Password");
    expect(pw).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(pw).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("tab", { name: "Sign up" }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
  });

  it("sign-up with a taken email says so and offers Log in", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({ ok: false, json: () => Promise.resolve({ code: "email_taken" }) });
    view({ initialMode: "signup" });
    await user.click(screen.getByRole("radio", { name: "Email" }));
    await user.type(screen.getByLabelText("Full name"), "Asha Patil");
    await user.type(screen.getByLabelText("Email address"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "longenough1");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/This email already has an account/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByRole("tab", { name: "Log in" })).toHaveAttribute("aria-selected", "true");
  });

  it("typed values survive a remount (language switch)", async () => {
    const user = userEvent.setup();
    const first = view();
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    first.unmount();
    view();
    await waitFor(() => {
      expect(screen.getByLabelText("Mobile number")).toHaveValue("98765 43210");
    });
  });

  it("hides the Google button when no Google sign-in exists", () => {
    view({ google: null });
    expect(screen.queryByRole("button", { name: "Continue with Google" })).toBeNull();
  });
});
