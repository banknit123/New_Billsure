import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Lock, FileText, Building2 } from 'lucide-react';

const SECTIONS = {
  privacy: {
    title: 'Privacy Policy',
    icon: Shield,
    lastUpdated: '22 April 2026',
    content: [
      {
        heading: '1. About This Policy',
        text: `EasyBillsPay Pty Ltd (ABN pending) ("we", "our", "us") operates the website www.easybillspay.com.au and the EasyBillsPay bill management platform. This Privacy Policy explains how we collect, use, disclose, and protect your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).`
      },
      {
        heading: '2. Information We Collect',
        text: `We collect the following personal information when you use our service:
• Identity information: Full name, email address, phone number
• Financial information: Bank account details (BSB, account number), payment card details (processed by Stripe — we only store the last 4 digits), wallet balance, transaction history
• Bill information: Provider names, account numbers, biller codes, BPAY reference numbers, bill amounts, due dates
• Usage data: Login timestamps, IP addresses, device information, pages visited
• Communications: Support requests and feedback you send us`
      },
      {
        heading: '3. How We Collect Information',
        text: `We collect information:
• Directly from you when you register, add bills, or contact us
• From uploaded documents (PDFs, images) via our bill extraction feature
• From Stripe when you make payments
• Automatically through cookies and analytics when you use our website`
      },
      {
        heading: '4. How We Use Your Information',
        text: `We use your personal information to:
• Provide and manage your bill payment services
• Process payments via Stripe on your behalf
• Send bill reminders, payment confirmations, and overdue notifications
• Calculate your payment plan deductions
• Operate the admin panel for bill payment processing
• Comply with legal and regulatory obligations
• Improve our services and user experience
• Detect and prevent fraud`
      },
      {
        heading: '5. Data Storage & Security',
        text: `Your data is protected with industry-leading security measures:
• All sensitive financial data (bank account numbers, BSB codes, routing numbers) is encrypted at rest using AES-128-CBC (Fernet) encryption
• Credit/debit card details are never stored on our servers — Stripe (PCI DSS Level 1 certified) handles all card data
• API responses always return masked values (e.g., ****1234)
• All connections use HTTPS with TLS encryption in transit
• Security headers (HSTS, X-Frame-Options, X-Content-Type-Options) are enforced
• Rate limiting protects against brute force attacks on authentication
• JWT tokens expire after 4 hours for session security`
      },
      {
        heading: '6. Disclosure of Information',
        text: `We may disclose your personal information to:
• Stripe Inc. — for payment processing (Stripe's privacy policy applies to data they process)
• Utility providers — only the minimum information necessary to process bill payments on your behalf (biller code, reference number, payment amount)
• Law enforcement — if required by law, court order, or legal process
• Professional advisors — accountants, lawyers, auditors bound by confidentiality

We do NOT sell your personal information to third parties. We do NOT share your data with marketing or advertising companies.`
      },
      {
        heading: '7. Cross-Border Data Transfers',
        text: `Your data is primarily stored in Australia. Some services we use (Stripe, cloud infrastructure) may process data in overseas locations including the United States. Where this occurs, we ensure appropriate safeguards are in place consistent with APP 8 requirements.`
      },
      {
        heading: '8. Your Rights',
        text: `Under the Privacy Act 1988, you have the right to:
• Access your personal information held by us
• Request correction of inaccurate information
• Complain about a breach of the APPs
• Request deletion of your account and associated data

To exercise these rights, contact us at privacy@easybillspay.com.au. We will respond within 30 days.`
      },
      {
        heading: '9. Data Retention',
        text: `We retain your data for as long as your account is active. After account closure:
• Financial records are retained for 7 years as required by Australian tax law
• Personal identification data is deleted within 90 days
• Encrypted financial data is permanently destroyed after the retention period`
      },
      {
        heading: '10. Data Breach Notification',
        text: `In the event of an eligible data breach under the Notifiable Data Breaches (NDB) scheme, we will:
• Notify the Office of the Australian Information Commissioner (OAIC) within 30 days
• Notify affected individuals as soon as practicable
• Take immediate steps to contain the breach and mitigate harm`
      },
      {
        heading: '11. Cookies',
        text: `We use essential cookies for authentication (JWT tokens stored in localStorage) and session management. We do not use third-party tracking cookies or advertising cookies.`
      },
      {
        heading: '12. Changes to This Policy',
        text: `We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Modified" date. We will notify you of significant changes via email.`
      },
      {
        heading: '13. Contact Us',
        text: `If you have questions about this Privacy Policy or wish to make a complaint:
• Email: privacy@easybillspay.com.au
• Website: www.easybillspay.com.au
• Office of the Australian Information Commissioner: www.oaic.gov.au (if you are unsatisfied with our response)`
      }
    ]
  },
  terms: {
    title: 'Terms of Service',
    icon: FileText,
    lastUpdated: '22 April 2026',
    content: [
      {
        heading: '1. Acceptance of Terms',
        text: `By accessing or using the EasyBillsPay platform (www.easybillspay.com.au), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the service. These Terms constitute a legally binding agreement between you and EasyBillsPay Pty Ltd.`
      },
      {
        heading: '2. Service Description',
        text: `EasyBillsPay provides a bill management and payment service. We:
• Allow you to upload and manage your household and business bills
• Calculate fixed deduction payment plans (weekly, fortnightly, or monthly) with an 8% safety buffer
• Collect funds into your EasyBillsPay wallet via Stripe
• Pay your bills on your behalf using BPAY or direct bank transfer before their due dates
• Send notifications about upcoming, overdue, and paid bills

We act as a bill payment intermediary — we are not a financial advisor, credit provider, or insurance broker.`
      },
      {
        heading: '3. Account Registration',
        text: `To use the service, you must:
• Be at least 18 years old
• Provide accurate and current registration information (name, email, phone)
• Maintain the security of your login credentials
• Notify us immediately of any unauthorised access

You are responsible for all activity on your account. We reserve the right to suspend or terminate accounts that violate these Terms.`
      },
      {
        heading: '4. Bill Upload & Data Accuracy',
        text: `You are responsible for:
• Ensuring bill details (provider, amount, due date, biller code, reference number) are accurate
• Reviewing extracted data before saving — our PDF/image extraction uses AI and may occasionally misread information
• Updating bill details if amounts or due dates change

We are not liable for late payments caused by incorrect information you provided.`
      },
      {
        heading: '5. Payment Plans & Wallet',
        text: `• Payment plans calculate a fixed deduction based on your total pending bills plus an 8% safety buffer
• Funds are collected into your EasyBillsPay wallet via Stripe
• We deduct the fixed amount from your wallet on your chosen schedule
• Bills are paid from your wallet balance when due
• If your wallet balance is insufficient, bills will remain pending — we will notify you
• Excess wallet balance remains as credit for future bills
• You may change plans or cancel at any time without penalty`
      },
      {
        heading: '6. Payments & Fees',
        text: `• Standard payment processing (credit card, debit card) is handled by Stripe
• Standard Stripe processing fees may apply (see Stripe's fee schedule)
• EasyBillsPay does not charge additional platform fees at this time
• We reserve the right to introduce fees with 30 days' notice
• Refunds of wallet balance are available upon account closure, minus any pending bill obligations`
      },
      {
        heading: '7. Bill Payment Process',
        text: `When paying bills on your behalf:
• We use the biller code and reference number you provided to process BPAY payments or direct bank transfers
• Payments are typically processed within 1-2 business days
• We are not responsible for delays caused by banks, payment networks, or utility providers
• You acknowledge that we pay bills from our company bank account and deduct the corresponding amount from your wallet`
      },
      {
        heading: '8. Limitation of Liability',
        text: `To the maximum extent permitted by law:
• Our liability is limited to the amount held in your wallet
• We are not liable for late fees, disconnections, or penalties arising from incorrect bill details, insufficient wallet balance, or payment network failures
• We are not liable for any indirect, incidental, or consequential damages
• Nothing in these Terms excludes or limits liability that cannot be excluded under Australian Consumer Law`
      },
      {
        heading: '9. Australian Consumer Law',
        text: `Our services come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and compensation for any other reasonably foreseeable loss or damage. You are also entitled to have the services repaired or re-supplied if the services fail to be of acceptable quality.`
      },
      {
        heading: '10. Termination',
        text: `• You may close your account at any time by contacting support@easybillspay.com.au
• Upon closure, any remaining wallet balance (minus pending bills) will be refunded within 14 business days
• We may terminate your account for violation of these Terms with written notice
• Sections relating to liability, indemnity, and dispute resolution survive termination`
      },
      {
        heading: '11. Dispute Resolution',
        text: `If you have a dispute with us:
1. Contact us at support@easybillspay.com.au — we aim to resolve issues within 5 business days
2. If unresolved, you may lodge a complaint with the Australian Financial Complaints Authority (AFCA) if applicable, or your relevant state consumer affairs body
3. These Terms are governed by the laws of New South Wales, Australia`
      },
      {
        heading: '12. Changes to Terms',
        text: `We may modify these Terms at any time. We will notify you by email at least 14 days before material changes take effect. Continued use after changes constitutes acceptance.`
      },
      {
        heading: '13. Contact',
        text: `EasyBillsPay Pty Ltd
Email: support@easybillspay.com.au
Website: www.easybillspay.com.au
Location: Sydney, NSW, Australia`
      }
    ]
  },
  becs: {
    title: 'BECS Direct Debit Service Agreement',
    icon: Building2,
    lastUpdated: '22 April 2026',
    content: [
      {
        heading: '1. Definitions',
        text: `"Account" means the bank account from which you authorise us to arrange for funds to be debited.
"Agreement" means this BECS Direct Debit Service Agreement.
"Business Day" means a day which is not a Saturday, Sunday, or public holiday in the state where your account is held.
"Debit Day" means the day your payment plan deduction is scheduled.
"Debit Payment" means a particular transaction where a debit is made.
"Direct Debit Request (DDR)" means your authorisation for us to debit your account via BECS.
"Us/We/Our" means EasyBillsPay Pty Ltd.
"You/Your" means the account holder who has signed the DDR.`
      },
      {
        heading: '2. Debiting Your Account',
        text: `By signing a Direct Debit Request, you authorise us to arrange for funds to be debited from your account through the Bulk Electronic Clearing System (BECS) at Stripe's discretion. Payments are processed according to your chosen plan frequency (weekly, fortnightly, or monthly). We will only debit your account for the agreed fixed amount as displayed in your payment plan.`
      },
      {
        heading: '3. Your Obligations',
        text: `It is your responsibility to:
• Ensure your nominated account can accept direct debits (not all accounts do — check with your bank)
• Ensure sufficient funds are available on the Debit Day
• Advise us if the account is transferred or closed
• Arrange with us a suitable alternative payment method if your account details change`
      },
      {
        heading: '4. Changes & Disputes',
        text: `If you believe a debit has been initiated incorrectly:
• Contact us at support@easybillspay.com.au and we will investigate within 5 business days
• You may also contact your bank to dispute the debit under the BECS rules
• You can request a stop or cancellation at any time by contacting us or your bank

We will process your stop, deferral, or alteration request within 3 business days.`
      },
      {
        heading: '5. Your Rights',
        text: `You have the right to:
• Cancel your DDR at any time by contacting us
• Stop or defer any individual payment
• Request changes to the debit amount or schedule
• Obtain a refund for any debit that was not authorised or processed incorrectly

Refunds for unauthorised debits will be processed within 5 business days of your claim.`
      },
      {
        heading: '6. Our Obligations',
        text: `We will:
• Give you at least 14 days' notice of any changes to the terms of this Agreement
• Not disclose your bank account details to any third party other than Stripe (our payment processor) except as required by law
• Investigate and resolve disputes within the timeframes required by BECS rules
• Keep records of your DDR for the life of the agreement and 7 years after its expiry`
      },
      {
        heading: '7. Privacy & Confidentiality',
        text: `Your bank account information is treated as confidential. It will be:
• Encrypted at rest using AES-128 encryption
• Only disclosed to Stripe for payment processing
• Handled in accordance with our Privacy Policy
• Never sold to or shared with third parties for marketing purposes`
      }
    ]
  }
};

export default function LegalPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const path = location.pathname.split('/').pop();
  const section = SECTIONS[path] || SECTIONS.privacy;
  const Icon = section.icon;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            EasyBillsPay
          </button>
          <Button variant="outline" onClick={() => navigate(-1)} className="border-slate-300 text-sm h-9">
            <ArrowLeft size={14} className="mr-1.5" /> Back
          </Button>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Icon size={20} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }} data-testid="legal-page-title">
              {section.title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Last updated: {section.lastUpdated}</p>
          </div>
        </div>

        {/* Quick nav to other legal pages */}
        <div className="flex gap-2 mt-6 mb-10 flex-wrap">
          {Object.entries(SECTIONS).map(([key, s]) => (
            <button
              key={key}
              onClick={() => navigate(`/legal/${key}`)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                path === key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
              data-testid={`legal-nav-${key}`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {section.content.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6" data-testid={`legal-section-${i}`}>
              <h2 className="text-base font-semibold text-slate-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {item.heading}
              </h2>
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {item.text}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} EasyBillsPay Pty Ltd. All rights reserved. Australian owned & operated.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Questions? Contact <a href="mailto:support@easybillspay.com.au" className="text-blue-600 hover:underline">support@easybillspay.com.au</a>
          </p>
        </div>
      </main>
    </div>
  );
}
