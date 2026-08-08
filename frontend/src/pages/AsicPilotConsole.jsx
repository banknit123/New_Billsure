import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

// ---------------------------------------------------------------
// ASIC ERS pilot testing console.
//
// DELIBERATELY SEPARATE from the rest of this app's data/auth model:
// - Talks only to PILOT_API_BASE (the standalone pilot_api.py service
//   and its own sandbox database) -- never to the `API` constant used
//   everywhere else in this app (App.js), which points at the LIVE
//   product's backend and LIVE customer data.
// - Uses its own API-key auth (see backend/pilot_auth.py), stored under
//   a distinct sessionStorage/localStorage key, never touching the
//   `token` key the rest of this app uses for real user sessions.
//
// DEPLOYMENT NOTE: this page ships as part of the same frontend build
// as the live product. If this app is deployed to a real customer-
// facing domain, this route becomes reachable there too (at whatever
// path it's mounted under) unless deliberately excluded from that
// build or gated separately. See the ASIC ERS evidence pack
// (docs/asic-ers-readiness/) for the full context on why this exists
// and what it is not authorised to do -- move real money.
// ---------------------------------------------------------------

const PILOT_API_BASE = process.env.REACT_APP_PILOT_API_URL || 'https://pilot-api.billsure.com.au';
const STORAGE_KEY = 'billsure_pilot_key';

function useAsicPilotApi() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [log, setLog] = useState([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, apiKey);
  }, [apiKey]);

  const call = useCallback(async (label, method, path, { json, form, auth = true } = {}) => {
    const headers = {};
    if (auth && apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const opts = { method, headers };
    if (json) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(json); }
    if (form) { opts.body = form; }

    let status = 0;
    let body = null;
    try {
      const resp = await fetch(PILOT_API_BASE + path, opts);
      status = resp.status;
      try { body = await resp.json(); } catch { body = await resp.text(); }
    } catch (e) {
      body = { error: String(e) };
    }
    setLog(prev => [{ id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), label, method, path, status, body }, ...prev]);
    return { status, body };
  }, [apiKey]);

  return { apiKey, setApiKey, log, call };
}

function uuid() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ (window.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
}

function StatusBadge({ status }) {
  if (status === 0) return <Badge variant="destructive">network error</Badge>;
  if (status >= 200 && status < 300) return <Badge className="bg-teal text-white hover:bg-teal">{status}</Badge>;
  if (status >= 400 && status < 500) return <Badge variant="outline" className="border-amber-400 text-amber-700">{status}</Badge>;
  return <Badge variant="destructive">{status}</Badge>;
}

export default function AsicPilotConsole() {
  const { apiKey, setApiKey, log, call } = useAsicPilotApi();
  const [gatesAuthorized, setGatesAuthorized] = useState(null);

  // Journey state, threaded between tabs the same way the standalone
  // HTML console does -- so testers don't have to copy-paste IDs.
  const [customerId, setCustomerId] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [billId, setBillId] = useState('');

  const checkGates = useCallback(async () => {
    const { body } = await call('Launch gate status', 'GET', '/pilot/launch-gates/status', { auth: false });
    if (typeof body === 'object' && body && 'production_authorized' in body) {
      setGatesAuthorized(body.production_authorized);
    }
  }, [call]);

  useEffect(() => { checkGates(); }, [checkGates]);

  // ---- Onboarding ----
  const [obState, setObState] = useState('VIC');
  const [obIncome, setObIncome] = useState('5200');
  const [obExpenses, setObExpenses] = useState('2800');
  const [obPurpose, setObPurpose] = useState('electricity');
  const [obEmployment, setObEmployment] = useState('full_time');

  const submitApply = async () => {
    const newCustomerId = uuid();
    const { status, body } = await call('Apply', 'POST', '/pilot/onboarding/apply', {
      json: {
        user_id: newCustomerId, identity_verification_status: 'verified', age_confirmed: true,
        residential_state: obState, bank_account_verified: true,
        income_amount: obIncome, income_frequency: 'monthly', employment_status: obEmployment,
        recurring_living_expenses: obExpenses, existing_debts_and_bnpl: '0',
        requested_credit_purpose: obPurpose, requirements_and_objectives: 'Submitted via BillSure pilot console',
        utility_bill_ownership_verified: true, vulnerability_indicators: [], bankruptcy_status: 'none',
        consent_types_accepted: ['privacy', 'identity_check', 'affordability_check', 'fraud_check'],
      },
    });
    if (status === 200) {
      setCustomerId(newCustomerId);
      setApplicationId(body.id);
    }
  };

  // ---- Credit activation ----
  const [acLimit, setAcLimit] = useState('2500.00');
  const [acPrepared, setAcPrepared] = useState('credit_assessor_1');
  const [acApproved, setAcApproved] = useState('compliance_lead');

  const activateCredit = () => call('Activate credit', 'POST', `/pilot/onboarding/${applicationId}/activate-credit`, {
    json: { prepared_by: acPrepared, approved_by: acApproved, contractual_limit: acLimit, active_customer_count: 0, current_aggregate_contractual_exposure: '0' },
  });

  // ---- Bills ----
  const [billName, setBillName] = useState('Test Customer');
  const [billCategory, setBillCategory] = useState('electricity');
  const [billFile, setBillFile] = useState(null);

  const uploadBill = async () => {
    if (!billFile) return;
    const form = new FormData();
    form.append('customer_id', customerId);
    form.append('customer_name_on_account', billName);
    form.append('category', billCategory);
    form.append('file', billFile);
    const { status, body } = await call('Upload bill', 'POST', '/pilot/bills/upload', { form });
    if (status === 200 && body?.bill?.id) setBillId(body.bill.id);
  };

  const payBill = () => call('Pay bill', 'POST', `/pilot/bills/${billId}/pay`, {
    json: { customer_id: customerId, requested_by: 'payments_admin' },
  });

  // ---- Hardship / complaints / balance ----
  const [hardshipReason, setHardshipReason] = useState('Reduced hours at work');
  const requestHardship = () => call('Hardship request', 'POST', '/pilot/hardship/requests', {
    json: { customer_id: customerId, reason: hardshipReason, vulnerability_indicators: [], requested_by: 'customer' },
  });

  const [complaintDescription, setComplaintDescription] = useState('Test complaint from the pilot console');
  const submitComplaint = () => call('Complaint', 'POST', '/pilot/complaints', {
    json: { customer_id: customerId, channel: 'web_form', description: complaintDescription, category: 'standard', severity: 'medium', received_by: 'console_operator' },
  });

  const checkBalance = () => call('Balance check', 'GET', `/pilot/credit/accounts/${customerId}/balance`, {});

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-horizontal.png" alt="BillSure" className="h-8" />
          <span className="text-slate-300">|</span>
          <span className="text-sm font-semibold text-navy">ASIC ERS Pilot Console</span>
        </div>
        {gatesAuthorized === false && (
          <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <ShieldAlert size={14} /> gates closed — no real money can move
          </div>
        )}
        {gatesAuthorized === true && (
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1">
            <CheckCircle2 size={14} /> production authorized
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-red-800">
              <p className="font-semibold">Sandbox only — no real money.</p>
              <p className="text-red-700">
                This talks to the ASIC ERS pilot's sandbox API and database, entirely separate from BillSure's live
                product. Real-money functionality stays disabled until every regulatory launch gate is genuinely
                approved — confirmed live above, not just asserted here.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Authorization</CardTitle>
            <CardDescription>Stored only in this browser. Issued via <code>issue_pilot_api_key.py</code>.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="pilot-api-key" className="sr-only">API key</Label>
            <Input id="pilot-api-key" type="password" placeholder="bsp_..." value={apiKey} onChange={e => setApiKey(e.target.value)} className="max-w-md" />
          </CardContent>
        </Card>

        <Tabs defaultValue="onboarding">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="bills">Bills</TabsTrigger>
            <TabsTrigger value="hardship">Hardship</TabsTrigger>
            <TabsTrigger value="complaints">Complaints</TabsTrigger>
            <TabsTrigger value="balance">Balance</TabsTrigger>
          </TabsList>

          <TabsContent value="onboarding" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Apply</CardTitle><CardDescription>Deterministic eligibility — no opaque scoring.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Residential state</Label><Input value={obState} onChange={e => setObState(e.target.value)} /></div>
                  <div><Label>Employment status</Label><Input value={obEmployment} onChange={e => setObEmployment(e.target.value)} /></div>
                  <div><Label>Income (monthly, AUD)</Label><Input value={obIncome} onChange={e => setObIncome(e.target.value)} /></div>
                  <div><Label>Essential expenses (monthly)</Label><Input value={obExpenses} onChange={e => setObExpenses(e.target.value)} /></div>
                </div>
                <Button onClick={submitApply} className="bg-navy hover:bg-navy-700">Submit application</Button>
                {customerId && <p className="text-xs text-slate-500">Customer UUID: <code>{customerId}</code></p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Activate credit</CardTitle><CardDescription>Maker-checker: preparer and approver must be distinct.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Application ID</Label><Input value={applicationId} onChange={e => setApplicationId(e.target.value)} /></div>
                  <div><Label>Contractual limit</Label><Input value={acLimit} onChange={e => setAcLimit(e.target.value)} /></div>
                  <div><Label>Prepared by</Label><Input value={acPrepared} onChange={e => setAcPrepared(e.target.value)} /></div>
                  <div><Label>Approved by</Label><Input value={acApproved} onChange={e => setAcApproved(e.target.value)} /></div>
                </div>
                <Button onClick={activateCredit} disabled={!applicationId} className="bg-navy hover:bg-navy-700">Activate credit account</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bills" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Upload a bill</CardTitle><CardDescription>Real OCR runs server-side.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Customer UUID</Label><Input value={customerId} onChange={e => setCustomerId(e.target.value)} /></div>
                  <div><Label>Name on account</Label><Input value={billName} onChange={e => setBillName(e.target.value)} /></div>
                  <div>
                    <Label>Category</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={billCategory} onChange={e => setBillCategory(e.target.value)}>
                      <option value="electricity">Electricity</option>
                      <option value="gas">Gas</option>
                      <option value="water">Water</option>
                      <option value="telecommunications">Telecommunications</option>
                    </select>
                  </div>
                  <div><Label>Bill file (PDF/JPG/PNG)</Label><Input type="file" onChange={e => setBillFile(e.target.files[0])} /></div>
                </div>
                <Button onClick={uploadBill} className="bg-navy hover:bg-navy-700">Upload &amp; verify</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Pay a bill</CardTitle><CardDescription>Checks the regulatory launch gate first — expect 403 until every gate is approved.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bill ID</Label><Input value={billId} onChange={e => setBillId(e.target.value)} /></div>
                  <div><Label>Customer UUID</Label><Input value={customerId} onChange={e => setCustomerId(e.target.value)} /></div>
                </div>
                <Button onClick={payBill} variant="destructive" disabled={!billId}>Attempt payment</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hardship">
            <Card>
              <CardHeader><CardTitle className="text-base">Request hardship support</CardTitle><CardDescription>No payment-status gate — always reachable.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Customer UUID</Label><Input value={customerId} onChange={e => setCustomerId(e.target.value)} /></div>
                <div><Label>Reason</Label><Textarea value={hardshipReason} onChange={e => setHardshipReason(e.target.value)} rows={2} /></div>
                <Button onClick={requestHardship} className="bg-navy hover:bg-navy-700">Submit hardship request</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complaints">
            <Card>
              <CardHeader><CardTitle className="text-base">Submit a complaint</CardTitle><CardDescription>Deadlines computed from ASIC RG 271 on intake.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Customer UUID</Label><Input value={customerId} onChange={e => setCustomerId(e.target.value)} /></div>
                <div><Label>Description</Label><Textarea value={complaintDescription} onChange={e => setComplaintDescription(e.target.value)} rows={2} /></div>
                <Button onClick={submitComplaint} className="bg-navy hover:bg-navy-700">Submit complaint</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balance">
            <Card>
              <CardHeader><CardTitle className="text-base">Check balance</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Customer UUID</Label><Input value={customerId} onChange={e => setCustomerId(e.target.value)} /></div>
                <Button onClick={checkBalance} className="bg-navy hover:bg-navy-700">Get balance</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-200">Response log</CardTitle></CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-3">
            {log.length === 0 && <p className="text-xs text-slate-500 italic">No requests yet.</p>}
            {log.map(entry => (
              <div key={entry.id} className="border-b border-slate-800 pb-3 last:border-0">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <span>{entry.time}</span>
                  <span>{entry.method} {entry.path}</span>
                  <StatusBadge status={entry.status} />
                  <span>{entry.label}</span>
                  {entry.status >= 400 && <XCircle size={12} className="text-red-400" />}
                </div>
                <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">{JSON.stringify(entry.body, null, 2)}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
