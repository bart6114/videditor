import { useEffect, useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import WorkspaceLayout from '@/components/layout/WorkspaceLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useApi } from '@/lib/api/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  Loader2,
  CreditCard,
  Plus,
  Trash2,
  Zap,
  History,
  AlertCircle,
  Check,
  Building2,
} from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface CreditInfo {
  credits: number;
  autoTopUpEnabled: boolean;
  autoTopUpThreshold: number;
  autoTopUpAmount: number;
  hasPaymentMethod: boolean;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

const CREDIT_PACKAGES = [
  { credits: 10, price: 1.0 },
  { credits: 25, price: 2.5 },
  { credits: 50, price: 5.0 },
  { credits: 100, price: 10.0 },
];

function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { call } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Get setup intent client secret
      const { clientSecret } = await call<{ clientSecret: string }>('/v1/billing/payment-methods/setup', {
        method: 'POST',
      });

      // Confirm setup
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-border rounded-lg bg-background">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#ffffff',
                '::placeholder': { color: '#6b7280' },
              },
            },
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Add Card
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function BillingContent() {
  const { call } = useApi();
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [savingAutoTopUp, setSavingAutoTopUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [credits, methods, txHistory] = await Promise.all([
        call<CreditInfo>('/v1/billing/credits'),
        call<{ paymentMethods: PaymentMethod[] }>('/v1/billing/payment-methods'),
        call<{ transactions: Transaction[] }>('/v1/billing/transactions?limit=10'),
      ]);
      setCreditInfo(credits);
      setPaymentMethods(methods.paymentMethods);
      setTransactions(txHistory.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handlePurchase(credits: number) {
    setPurchasing(credits);
    setError(null);

    try {
      const result = await call<{
        success: boolean;
        newBalance?: number;
        requiresAction?: boolean;
        clientSecret?: string;
      }>('/v1/billing/purchase', {
        method: 'POST',
        body: JSON.stringify({ creditAmount: credits }),
      });

      if (result.success) {
        setSuccessMessage(`Successfully purchased ${credits} credits!`);
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } else if (result.requiresAction || result.clientSecret) {
        // Handle 3D Secure or redirect to add payment method
        setError('Please add a payment method first');
        setShowAddCard(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  }

  async function handleDeletePaymentMethod(id: string) {
    try {
      await call(`/v1/billing/payment-methods/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove card');
    }
  }

  async function handleAutoTopUpToggle(enabled: boolean) {
    setSavingAutoTopUp(true);
    setError(null);

    try {
      await call('/v1/billing/auto-topup', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setCreditInfo((prev) => (prev ? { ...prev, autoTopUpEnabled: enabled } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto top-up');
    } finally {
      setSavingAutoTopUp(false);
    }
  }

  async function handleAutoTopUpSettingsChange(threshold: number, amount: number) {
    try {
      await call('/v1/billing/auto-topup', {
        method: 'PATCH',
        body: JSON.stringify({ threshold, amount }),
      });
      setCreditInfo((prev) =>
        prev ? { ...prev, autoTopUpThreshold: threshold, autoTopUpAmount: amount } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Billing & Credits</h2>
        <p className="text-muted-foreground">Manage your credits and payment methods</p>
        {currentOrganization && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Billing for:</span>
            <span className="font-medium text-foreground">{currentOrganization.name}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-2">
          <Check className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {/* Credit Balance */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Credit Balance
            </h3>
            <p className="text-sm text-muted-foreground">1 credit = 1 short generated</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-foreground">{creditInfo?.credits ?? 0}</div>
            <div className="text-sm text-muted-foreground">credits</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CREDIT_PACKAGES.map(({ credits, price }) => (
            <button
              key={credits}
              onClick={() => handlePurchase(credits)}
              disabled={purchasing !== null || paymentMethods.length === 0}
              className="p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {purchasing === credits ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <>
                  <div className="text-xl font-bold text-foreground">{credits}</div>
                  <div className="text-sm text-muted-foreground">credits</div>
                  <div className="text-sm font-medium text-primary mt-1">${price.toFixed(2)}</div>
                </>
              )}
            </button>
          ))}
        </div>

        {paymentMethods.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            Add a payment method below to purchase credits
          </p>
        )}
      </Card>

      {/* Payment Methods */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Methods
          </h3>
          {!showAddCard && (
            <Button size="sm" variant="outline" onClick={() => setShowAddCard(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          )}
        </div>

        {showAddCard && (
          <div className="mb-4 p-4 border border-border rounded-lg bg-muted/20">
            <h4 className="text-sm font-medium mb-3">Add New Card</h4>
            <AddCardForm
              onSuccess={() => {
                setShowAddCard(false);
                loadData();
              }}
              onCancel={() => setShowAddCard(false)}
            />
          </div>
        )}

        {paymentMethods.length === 0 && !showAddCard ? (
          <p className="text-sm text-muted-foreground">No payment methods saved</p>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground capitalize">
                      {pm.brand} •••• {pm.last4}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Expires {pm.expMonth}/{pm.expYear}
                    </div>
                  </div>
                  {pm.isDefault && (
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                      Default
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeletePaymentMethod(pm.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Auto Top-Up */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Auto Top-Up</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Automatically purchase credits when your balance falls below a threshold
        </p>

        <div className="flex items-center gap-3 mb-4">
          <Switch
            id="autoTopUp"
            checked={creditInfo?.autoTopUpEnabled ?? false}
            onCheckedChange={handleAutoTopUpToggle}
            disabled={savingAutoTopUp || paymentMethods.length === 0}
          />
          <label htmlFor="autoTopUp" className="text-sm text-foreground cursor-pointer">
            {savingAutoTopUp ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Enable auto top-up'
            )}
          </label>
        </div>

        {creditInfo?.autoTopUpEnabled && (
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">
                Top up when below
              </label>
              <select
                value={creditInfo.autoTopUpThreshold}
                onChange={(e) =>
                  handleAutoTopUpSettingsChange(
                    parseInt(e.target.value),
                    creditInfo.autoTopUpAmount
                  )
                }
                className="w-full p-2 bg-input border border-border rounded-lg text-foreground"
              >
                <option value={3}>3 credits</option>
                <option value={5}>5 credits</option>
                <option value={10}>10 credits</option>
                <option value={20}>20 credits</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Amount to add</label>
              <select
                value={creditInfo.autoTopUpAmount}
                onChange={(e) =>
                  handleAutoTopUpSettingsChange(
                    creditInfo.autoTopUpThreshold,
                    parseInt(e.target.value)
                  )
                }
                className="w-full p-2 bg-input border border-border rounded-lg text-foreground"
              >
                <option value={10}>10 credits ($1.00)</option>
                <option value={25}>25 credits ($2.50)</option>
                <option value={50}>50 credits ($5.00)</option>
                <option value={100}>100 credits ($10.00)</option>
              </select>
            </div>
          </div>
        )}

        {paymentMethods.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Add a payment method to enable auto top-up
          </p>
        )}
      </Card>

      {/* Transaction History */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
          <History className="w-5 h-5" />
          Recent Transactions
        </h3>

        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
              >
                <div>
                  <div className="font-medium text-foreground">{tx.description}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString()} at{' '}
                    {new Date(tx.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Balance: {tx.balanceAfter}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <WorkspaceLayout title="Billing">
      <Elements stripe={stripePromise}>
        <BillingContent />
      </Elements>
    </WorkspaceLayout>
  );
}
