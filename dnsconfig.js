var domainName = "has-a.link";
var registrar = NewRegistrar("none");
var dnsProvider = DnsProvider(NewDnsProvider("cloudflare"));

function getDomainsList(filesPath) {
  var result = [];
  var files = glob.apply(null, [filesPath, true, ".json"]);

  for (var i = 0; i < files.length; i++) {
    var name = files[i]
      .split(/[\\/]/)
      .pop()
      .replace(/\.json$/, "");

    result.push({ name: name, data: require(files[i]) });
  }

  return result;
}

var domains = getDomainsList("./domains");
var records = [];

for (var subdomain in domains) {
  var subdomainName = domains[subdomain].name;
  var data = domains[subdomain].data;
  var proxyState = data.proxied ? CF_PROXY_ON : CF_PROXY_OFF;

  // A records
  if (data.records.A) {
    for (var a in data.records.A) {
      records.push(A(subdomainName, IP(data.records.A[a]), proxyState));
    }
  }

  // AAAA records
  if (data.records.AAAA) {
    for (var aaaa in data.records.AAAA) {
      records.push(AAAA(subdomainName, data.records.AAAA[aaaa], proxyState));
    }
  }

  // CNAME records
  if (data.records.CNAME) {
    records.push(ALIAS(subdomainName, data.records.CNAME + ".", proxyState));
  }

  // TXT records
  if (data.records.TXT) {
    if (Array.isArray(data.records.TXT)) {
      for (var txt in data.records.TXT) {
        records.push(
          TXT(
            subdomainName,
            data.records.TXT[txt].length <= 255 ? '"' + data.records.TXT[txt] + '"' : data.records.TXT[txt]
          )
        );
      }
    } else {
      records.push(
        TXT(subdomainName, data.records.TXT.length <= 255 ? '"' + data.records.TXT + '"' : data.records.TXT)
      );
    }
  }
}

var reserved = require("./utils/reserved.json");
var internal = require("./utils/internal.json");

// Handle reserved domains (excluding names managed internally)
for (var i = 0; i < reserved.length; i++) {
  if (internal.indexOf(reserved[i]) !== -1) continue;
  records.push(A(reserved[i], IP("192.0.2.1"), CF_PROXY_ON));
}

// Zone last updated TXT record
records.push(TXT("_zone-updated", '"' + Date.now().toString() + '"'));

var ignored = [
  IGNORE("\\*", "A"),
  IGNORE("*._domainkey", "TXT"),
  IGNORE("@", "*"),
  IGNORE("_acme-challenge", "TXT"),
  IGNORE("_dmarc", "TXT"),
  IGNORE("_github-pages-challenge-*", "TXT"),
  IGNORE("_psl", "TXT"),
  IGNORE("cf-bounce", "MX,TXT")
];

internal.forEach(function (subdomain) {
  ignored.push(IGNORE(subdomain, "*"));
});

D(domainName, registrar, dnsProvider, records, ignored);
