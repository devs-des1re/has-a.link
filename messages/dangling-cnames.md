<!-- marker: dangling-cnames -->

## ⚠️ Dangling CNAME records detected

The scheduled DNS scan found subdomains whose `CNAME` target does not resolve. These may be vulnerable to subdomain takeover and should be reviewed.

{{findings}}

**Action:** verify each target is still controlled by its owner. If a target is permanently gone, ask the owner to update or remove the record, or remove it if the owner is unreachable.
