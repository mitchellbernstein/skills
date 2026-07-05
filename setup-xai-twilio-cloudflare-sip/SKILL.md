---
name: setup-xai-twilio-cloudflare-sip
description: Use this when setting up, verifying, or debugging an xAI Voice Agent phone number with Twilio Elastic SIP Trunking and an optional Cloudflare Worker webhook bridge. Covers Direct SIP routing, xAI allowed-address setup, Cloudflare Worker secrets, and Twilio/xAI failure diagnosis.
---

# xAI Voice Agent + Twilio + Cloudflare SIP Setup

Use this skill when a user wants an xAI Voice Agent reachable by a phone number that lives in Twilio, optionally with Cloudflare Workers handling xAI `realtime.call.incoming` webhooks.

## First Decision

Determine which xAI mode is being used:

- **Console-managed voice agent**: xAI Console owns the saved agent and phone-number assignment. Twilio routes directly to xAI SIP. A Cloudflare Worker is usually not in the live call path.
- **API-controlled SIP webhook**: xAI sends `realtime.call.incoming` webhooks to the user's endpoint. The Worker verifies the webhook, joins `wss://api.x.ai/v1/realtime?call_id=...`, sends `session.update`, then `response.create`.

Do not assume the Cloudflare Worker is required for console-managed agents. Verify the actual deployment path in xAI first.

## Correct Twilio Origination URI

For Twilio Elastic SIP Trunking, set the trunk Origination URI to the xAI hostname, not the raw IP shown in some xAI console modals:

```text
sip:{E164_NUMBER}@sip.voice.x.ai;transport=tls
```

Example:

```text
sip:+15551234567@sip.voice.x.ai;transport=tls
```

Important: `sip.voice.x.ai` may resolve to a raw IP, and some xAI console surfaces may display an IP-based SIP URI. Twilio should still route to the FQDN. TLS SIP can fail when configured with the raw IP because hostname/SNI/certificate behavior may differ.

## xAI Direct SIP Allowed Addresses

When using xAI Direct SIP with IP allowlisting, include all current Twilio Elastic SIP Trunking signaling CIDRs, not only the xAI Console's Twilio preset if it is stale.

Use these Twilio signaling CIDRs:

```text
54.172.60.0/30
54.244.51.0/30
54.171.127.192/30
54.169.127.128/30
35.156.191.128/30
54.65.63.192/30
54.252.254.64/30
177.71.206.192/30
```

If the xAI Console only shows four Twilio ranges, recreate or update the Direct SIP number so all eight ranges are allowed. In the observed xAI UI, editing an existing Direct SIP number did not expose allowed-address editing; the working path was:

1. Remove the existing Direct SIP number from the xAI agent.
2. Add the same Direct SIP number again.
3. Select the Twilio preset.
4. Manually add the missing four ranges:
   `35.156.191.128/30`, `54.65.63.192/30`, `54.252.254.64/30`, `177.71.206.192/30`.
5. Save and reopen the number to verify all eight ranges persisted.

## Twilio Trunk Checklist

In Twilio Console:

1. Go to **Voice > Elastic SIP Trunking**.
2. Open the trunk for the customer's number.
3. On **Numbers**, verify the phone number is assigned to that trunk.
4. On **Origination**, set one enabled URI:
   `sip:{E164_NUMBER}@sip.voice.x.ai;transport=tls`.
5. Save, reload the page, and verify the row still shows the xAI FQDN and the Save button is disabled.

Do not configure Twilio Origination to the xAI raw IP unless xAI support explicitly tells the user to do so.

## xAI Console Checklist

In xAI Console:

1. Open the target Voice Agent.
2. Check **Deployment > Phone numbers**.
3. Verify the number is assigned to the intended agent.
4. Verify the agent is published/current. If a Publish button is enabled, publish it.
5. Open the number and verify:
   - Phone number is the E.164 number.
   - SIP URI is shown for that number.
   - Allowed addresses include all Twilio signaling CIDRs above.

If xAI Voice logs show no new conversation for a failed inbound call, the call likely did not get past SIP admission into xAI.

## Cloudflare Worker Path

Use a Worker only for API-controlled SIP webhook setups, or if the user explicitly wants the webhook architecture.

The Worker must:

- Accept `POST /webhook`.
- Read the raw request body before parsing JSON.
- Verify xAI webhook headers:
  - `webhook-id`
  - `webhook-timestamp`
  - `webhook-signature`
- Validate HMAC over:

```text
{webhook-id}.{webhook-timestamp}.{rawBody}
```

- Reject stale timestamps, normally outside a 5 minute tolerance.
- Handle `realtime.call.incoming`.
- Extract `data.call_id`.
- Return `200` quickly.
- Use `ctx.waitUntil(...)` to connect to:

```text
wss://api.x.ai/v1/realtime?call_id={call_id}
```

- Authenticate with `Authorization: Bearer ${XAI_API_KEY}`.
- Send a `session.update` with voice, instructions, and `server_vad`.
- Send `response.create`.
- Log WebSocket status, xAI realtime events, close events, and errors.

Cloudflare secrets:

```sh
npx wrangler secret put XAI_API_KEY
npx wrangler secret put XAI_WEBHOOK_SECRET
```

The webhook signing secret is returned only once when registering an API-controlled xAI phone number. If the number was created in console-managed mode and no secret is available, do not invent one; either keep console-managed SIP routing or recreate the API-controlled phone-number route.

## API-Controlled Phone Number Registration

For API-controlled Direct SIP, create the xAI phone number with:

```sh
curl -X POST "https://api.x.ai/v2/phone-numbers" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "byo_trunk",
    "name": "Business main line",
    "phone_number": "+15551234567",
    "webhook": {
      "name": "Business xAI SIP webhook",
      "url": "https://YOUR_WORKER.workers.dev/webhook"
    },
    "sip_auth": {
      "allowed_addresses": [
        "54.172.60.0/30",
        "54.244.51.0/30",
        "54.171.127.192/30",
        "54.169.127.128/30",
        "35.156.191.128/30",
        "54.65.63.192/30",
        "54.252.254.64/30",
        "177.71.206.192/30"
      ]
    }
  }'
```

Immediately store the returned webhook signing secret in Cloudflare as `XAI_WEBHOOK_SECRET`.

## Diagnosis Workflow

When the user says calls fail:

1. Ask for or observe a fresh test call time.
2. Open Twilio **Monitor > Logs > Calls**.
3. Open the newest call to the business number.
4. Check:
   - Call SID
   - Direction: should be `Trunking Originating`
   - Trunk SID
   - Status
   - Warning/error codes
   - SIP PCAP/log if available
5. Open xAI **Logs > Voice** and check for a new conversation at the same time.

Interpret common findings:

- **Twilio `32011` warning**: Twilio could not communicate with the SIP endpoint. Check Origination URI. If it uses raw IP, change to `sip:{number}@sip.voice.x.ai;transport=tls`.
- **Twilio call fails at 0 seconds, no xAI Voice log**: Twilio reached trunk flow but xAI did not admit/start the call. Check xAI allowed addresses and Direct SIP number assignment.
- **xAI Voice log exists but call failed**: SIP admission worked. Inspect xAI conversation/session errors, agent publish state, model/voice configuration, and webhook Worker logs if API-controlled.
- **xAI webhook reaches Worker but call fails**: Check signature verification, `call_id` extraction, `waitUntil`, WebSocket upgrade status `101`, and API key validity.
- **Worker health OK but no webhook logs**: Twilio is not routed into the API-controlled xAI phone-number route, or xAI did not admit the SIP call.

## Verification

A setup is not proven until a real inbound call succeeds. Before asking the user to retest, verify:

- Twilio Origination row persists after reload.
- Twilio Number is assigned to the same trunk.
- xAI number is assigned to the intended agent.
- xAI allowed addresses include all eight Twilio signaling CIDRs.
- Agent is published/current.
- Worker `/health` returns `200` if using the Worker path.
- Worker tests/typecheck pass if code was changed.

After the user places a test call:

- If it works, record the final known-good settings.
- If it fails, immediately inspect the newest Twilio call log and xAI Voice logs before changing anything else.

## Security Notes

- Never paste API keys into final answers or skill examples.
- If a user pasted an API key into chat, recommend rotating it.
- Do not claim end-to-end success from config alone; require a real inbound call test.
- Be careful when removing/recreating an xAI Direct SIP number. Do it only when needed to update immutable or hidden SIP settings, and verify the number is reassigned afterward.
