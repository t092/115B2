from pathlib import Path
root = Path(__file__).resolve().parent.parent
out = root / 'silklemmings'
hub = root / 'index.html'
rules = root / 'firebase-rules/firestore.rules'
(out / 'hub-index.before.html').write_bytes(hub.read_bytes())
(out / 'firestore.before.rules').write_bytes(rules.read_bytes())
text = rules.read_text(encoding='utf-8-sig')
text = text.replace("          'DynaSoKOBAN'", "          'DynaSoKOBAN',\n          'silklemmings'")
text = text.replace('request.resource.data.baseScore <= 1000', "request.resource.data.baseScore <= (request.resource.data.unitName == 'silklemmings' ? 9007199254740991 : 1000)")
text = text.replace('request.resource.data.totalScore <= 1000', "request.resource.data.totalScore <= (request.resource.data.unitName == 'silklemmings' ? 9007199254740991 : 1000)")
text = text.replace("&& request.resource.data.status == 'pending_review'", "&& request.resource.data.status == 'pending_review'\n        && (request.resource.data.unitName != 'silklemmings' || (request.resource.data.completed == true && request.resource.data.bonusScore == 0 && request.resource.data.score == request.resource.data.totalScore))")
text = text.replace('      allow read: if false;', "      // Only the submitting session may verify its own Silk Road receipt.\n      allow get: if request.auth != null\n        && resource.data.unitName == 'silklemmings'\n        && resource.data.uid == request.auth.uid;\n      allow list: if false;")
rules.write_text(text, encoding='utf-8')
(out / 'firestore.deploy.rules').write_text(text, encoding='utf-8')
hub.write_bytes((out / 'hub-index.pending.html').read_bytes())
print('Updated hub and narrow Silk Road score rules; backups saved in silklemmings.')
