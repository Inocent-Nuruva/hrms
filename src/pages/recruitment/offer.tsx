import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from 'react';
import { useRouter } from 'next/router';
import { FileText } from 'lucide-react';
import { acceptPublicRecruitmentOffer, getPublicRecruitmentOffer, type PublicRecruitmentOffer } from '@/lib/admin-api';
import { API_BASE_URL } from '@/utils/constants';
import { Button } from '@/components/ui/button';

export default function RecruitmentOfferPage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [offer, setOffer] = React.useState<PublicRecruitmentOffer | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [accepted, setAccepted] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!router.isReady) return;
    if (!token) { setError('This offer link is incomplete. Contact HR for a new link.'); setLoading(false); return; }
    let active = true;
    void getPublicRecruitmentOffer(token)
      .then((result) => { if (active) setOffer(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'This offer is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router.isReady, token]);

  async function accept() {
    setSubmitting(true);
    setError('');
    try {
      await acceptPublicRecruitmentOffer(token);
      setAccepted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The offer could not be accepted.');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-12 text-foreground">
    <header className="border-b pb-5">
      <p className="text-sm font-medium text-muted-foreground">Employment offer</p>
      <h1 className="mt-2 text-2xl font-semibold">{accepted ? 'Offer accepted' : offer?.job_title ?? 'Review your offer'}</h1>
    </header>
    {loading ? <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><FluentLoadingIndicator className="size-4 animate-spin" /> Loading offer</div> : null}
    {!loading && offer && !accepted ? <div className="space-y-6 py-6">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
        <div><dt className="text-muted-foreground">Candidate</dt><dd className="mt-1 font-medium">{offer.candidate_name}</dd></div>
        <div><dt className="text-muted-foreground">Start date</dt><dd className="mt-1 font-medium">{offer.start_date}</dd></div>
        <div><dt className="text-muted-foreground">Monthly salary</dt><dd className="mt-1 font-medium">TZS {Number(offer.salary).toLocaleString()}</dd></div>
        <div><dt className="text-muted-foreground">Respond by</dt><dd className="mt-1 font-medium">{new Date(offer.offer_expires_at).toLocaleDateString()}</dd></div>
      </dl>
      {offer.has_letter ? <a className="inline-flex items-center gap-2 text-sm font-medium text-primary underline" href={`${API_BASE_URL}/api/recruitment/offers/letter?token=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer"><FileText className="size-4" /> Review offer letter</a> : null}
      <div className="border-t pt-5"><Button onClick={accept} disabled={submitting}>{submitting ? 'Accepting...' : 'Accept offer'}</Button></div>
    </div> : null}
    {accepted ? <p className="py-6 text-sm text-muted-foreground">HR will send your registration invitation next.</p> : null}
    {error ? <p role="alert" className="py-5 text-sm text-destructive">{error}</p> : null}
  </main>;
}
