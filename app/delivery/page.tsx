import { redirect } from 'next/navigation';

/** Legacy hub → main courier home */
export default function DeliveryHubRedirect() {
  redirect('/');
}
