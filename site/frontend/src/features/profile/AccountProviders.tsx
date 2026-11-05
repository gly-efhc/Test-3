/** Provider status reflects authenticated server session, never simulated toggles. */
import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuthSessionController } from "../../auth/AuthSessionProvider";
import { getTelegramInitData } from "../../lib/telegram";

export function AccountProviders(): React.JSX.Element {
  const auth = useAuthSessionController();
  const [message, setMessage] = useState("");
  const context = auth.status === "authenticated" ? auth.context : null;
  const telegramVerified = context?.provider === "telegram";
  const canTelegramLogin = Boolean(getTelegramInitData());
  return (
    <section className="grid gap-3" data-provider-state-source="server-session">
      <Card className="efhc-profile-action-card p-4">
        <div className="text-lg font-extrabold">Привязанные аккаунты</div>
        <p className="text-xs efhc-text-muted2">Показываются только подтверждённые сервером данные. Другие подключения не имитируются.</p>
        <p className="text-xs efhc-text-muted2">Global ID: {context?.global_id || "—"}</p>
      </Card>
      <Card className="efhc-profile-action-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold">Telegram</div>
            <div className="text-xs efhc-text-muted2" data-provider-state={telegramVerified ? "verified" : "unverified"}>
              {telegramVerified ? "Вход подтверждён" : "Нет подтверждённой Telegram-сессии"}
            </div>
          </div>
          <Button type="button" variant="secondary" disabled={!canTelegramLogin || auth.status === "authenticating"}
            onClick={() => void auth.loginTelegram().then(() => setMessage("Telegram подтверждён сервером")).catch(error => setMessage(error instanceof Error ? error.message : "Ошибка входа"))}>
            {telegramVerified ? "Обновить сессию" : "Подключить Telegram"}
          </Button>
        </div>
      </Card>
      <Card className="efhc-profile-action-card p-3">
        <div className="font-semibold">TON Connect</div>
        <p className="text-xs efhc-text-muted2">Подключение и проверка TON Proof выполняются в разделе «Кошелёк» через сервер EFHC.</p>
      </Card>
      {message ? <p role="status" className="text-xs efhc-text-muted2">{message}</p> : null}
    </section>
  );
}
