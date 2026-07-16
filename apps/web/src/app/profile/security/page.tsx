import { ChangePasswordForm } from "./change-password-form";

export default function ProfileSecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-muted-foreground">Change your password.</p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
