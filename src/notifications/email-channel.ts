import { renderDailyDigest, subjectFor } from '@/emails/daily-digest';
import type { DailyDigest } from '@/domain/types';
import type { NotificationChannel } from './channel';

/**
 * Email delivery, per ADR-005.
 *
 * The Resend client is injected rather than imported here so the mapping from
 * digest to message can be tested without stubbing a module or touching the
 * network. That is the whole reason this is a factory: there is exactly one
 * production sender, and the seam exists for the test, not for a second vendor.
 */

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export function createEmailChannel(deps: {
  sender: EmailSender;
  from: string;
}): NotificationChannel {
  return {
    async send(to: string, digest: DailyDigest): Promise<void> {
      // Failures propagate. The sweep catches them per roadmap so one bad send
      // does not stop everyone else's email.
      await deps.sender.send({
        to,
        from: deps.from,
        subject: subjectFor(digest),
        html: renderDailyDigest(digest),
      });
    },
  };
}

/** The real sender. Constructed only where a digest is actually delivered. */
export function resendSender(apiKey: string): EmailSender {
  return {
    async send(message: EmailMessage): Promise<void> {
      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);

      const { error } = await resend.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });

      // Resend reports failures in the body rather than by throwing, which would
      // otherwise look like a successful send and get written to the SendLog.
      if (error) {
        throw new Error(`Resend rejected the message: ${error.message}`);
      }
    },
  };
}
