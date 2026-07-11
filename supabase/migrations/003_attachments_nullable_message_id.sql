-- Attachments are uploaded before the message they belong to exists
-- (compose flow uploads files first, then links them to the message on send).
-- The FK requires message_id to reference a real message once set, but it
-- must be allowed to be NULL while the attachment is still unlinked.
alter table attachments alter column message_id drop not null;
