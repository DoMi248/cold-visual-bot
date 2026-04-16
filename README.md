# cold-visual-bot

Discord-Bot für Produkt-/Preislisten, Ticket-Abwicklung und PSC-Verarbeitung.

## Commands

> Prefix ist standardmäßig `!` (konfigurierbar über `COMMAND_PREFIX`).

### Pricelist

- `!pricelist`  
  Sendet die aktuelle Pricelist als Embed (in den konfigurierten Pricelist-Channel oder in den aktuellen Channel).

### Produktverwaltung

- `!product help`  
  Zeigt die Hilfe für Produktverwaltung.
- `!product list`  
  Listet alle Produkte.
- `!product add <id> <preis> <name>`  
  Erstellt ein neues Produkt oder überschreibt ein bestehendes mit derselben ID.
- `!product setprice <id> <preis>`  
  Ändert den Preis eines Produkts.
- `!product rename <id> <name>`  
  Ändert den Namen eines Produkts.
- `!product remove <id>`  
  Löscht ein Produkt.

Alias für `product`: `products`, `pack`, `packs`

### Paysafecard-Verwaltung

- `!psc help`  
  Zeigt die Hilfe für PSC-Befehle.
- `!psc list [limit]`  
  Listet die letzten gespeicherten PSC-Einträge (max. 20).
- `!psc show [ticketChannelId]`  
  Zeigt den neuesten PSC-Eintrag für einen Ticket-Channel (inkl. entschlüsseltem Code, nur für berechtigte User).

### Wartezimmer-Musik

- `!wartemusik help`  
  Zeigt die Hilfe für Musik-Befehle.
- `!wartemusik join [voiceChannelId]`  
  Lässt den Bot einem Talk beitreten und den konfigurierten Stream abspielen (Loop).
- `!wartemusik leave`  
  Stoppt die Musik und lässt den Bot den Talk verlassen.
- `!wartemusik status`  
  Zeigt den aktuellen Status der Wartezimmer-Musik.

Alias für `wartemusik`: `music`, `waitmusic`

## Ticket-/Kauf-Flow

- Käufer wählt Paket über Dropdown aus.
- Bei PSC wird ein Ticket erstellt und der PSC-Code verschlüsselt gespeichert.
- **Neu:** Bei jedem PSC-Kauf wird automatisch die Ticket-Channel-ID plus verschlüsselter Code in den konfigurierten Encrypt-Channel gepostet.
- **Neu:** Beim Schließen eines Tickets wird automatisch ein Transcript erstellt:
  - Post im konfigurierten Transcript-Channel
  - Versand als DM an den Käufer (Ticket-Owner)

## .env Konfiguration

```env
DISCORD_TOKEN=
GUILD_ID=
PRICELIST_CHANNEL_ID=
TICKET_TRANSCRIPT_CHANNEL_ID=
PSC_ENCRYPT_CHANNEL_ID=
COMMAND_PREFIX=!
PAYPAL_URL=https://paypal.me/your-paypal-link
PSC_ENCRYPTION_KEY=change-me-to-a-long-random-secret
MUSIC_STREAM_URL=
MUSIC_DEFAULT_VOICE_CHANNEL_ID=
```

### Erklärung der neuen Variablen

- `TICKET_TRANSCRIPT_CHANNEL_ID`  
  Ziel-Channel für Ticket-Transcripts.
- `PSC_ENCRYPT_CHANNEL_ID`  
  Ziel-Channel für PSC-Encrypt-Logs (Channel-ID + verschlüsselter Code).
- `MUSIC_STREAM_URL`  
  HTTP/HTTPS-Audioquelle für den Wartezimmer-Musikbot.
- `MUSIC_DEFAULT_VOICE_CHANNEL_ID`  
  Optionaler Standard-Talk, falls bei `join` kein Channel übergeben wurde und der Ausführende in keinem Talk ist.
