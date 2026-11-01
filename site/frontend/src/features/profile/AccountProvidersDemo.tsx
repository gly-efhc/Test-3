/**
 * Isolated Pages-only account-provider preview, not an OAuth implementation.
 * No credentials, cookies, Global ID mutations or backend calls.
 */
import React, { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

const PROVIDERS = ["Telegram", "Google", "Apple", "Facebook", "Discord", "GitHub"] as const;
type Provider = typeof PROVIDERS[number];

export function AccountProvidersDemo() {
  const [connected, setConnected] = useState<Provider[]>([]);
  if (process.env.NEXT_PUBLIC_EFHC_PAGES_PREVIEW !== "1") return null;
  const toggle = (provider: Provider) => {
    setConnected(previous => previous.includes(provider)
      ? previous.filter(item => item !== provider) : [...previous, provider]);
  };
  return (
    <section className="grid gap-3" data-efhc-provider-demo="readonly-simulation">
      <Card className="efhc-profile-action-card p-4">
        <div className="text-lg font-extrabold">Привязанные аккаунты</div>
      </Card>
      {PROVIDERS.map(provider => {
        const isConnected = connected.includes(provider);
        return (
          <Card key={provider} className="efhc-profile-action-card p-3" data-demo-provider={provider.toLowerCase()}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{provider}</div>
                <div className="text-xs efhc-text-muted2" data-provider-state={isConnected ? "simulated-linked" : "simulated-unlinked"}>
                  {isConnected ? "Привязан" : "Не привязан"}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                data-demo-provider-action={provider.toLowerCase()}
                aria-label={`${isConnected ? "Отключить" : "Подключить"} ${provider}`}
                onClick={() => toggle(provider)}
              >
                {isConnected ? `Отключить ${provider}` : `Подключить ${provider}`}
              </Button>
            </div>
          </Card>
        );
      })}
      <p className="text-xs efhc-text-muted2">
        Управление TON-кошельком доступно в разделе «Кошелёк».
      </p>
    </section>
  );
}
