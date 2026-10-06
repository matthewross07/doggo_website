# Adventure Dog Club — a booking idea

A friendly, unofficial demo of what booking drop-in dog training classes could feel like:
save your details when you join, then book classes by just picking times.

Live: https://matthewross07.github.io/doggo_website/

Not affiliated with Summit Dog Training. No real classes are booked and no payments are processed.
Everything is stored in your browser's localStorage. Use **Reset** in the top bar to start over, or open `#member` to jump straight to the returning-member view.

## What's on the page
- **The idea:** booking class-by-class vs. with a saved member profile
- **A working demo** (new member or returning member), described below
- **What Acuity can already do:** client accounts, View Redeemable Codes, one-time intake forms, personal dynamic links, "Add another time", each linked to Acuity's help center
- **Going further:** how a custom member page would be built

## Demo features
- One-time signup (you, your dog, membership tier) followed by a simulated Stripe Checkout
- Weekly schedule filtered to your dog's bandana level, with live spots left (6 dogs max)
- Multi-select booking ("Book 3 →") with undo
- Monthly credit meter (Standard = 5/month, Unlimited) and an upgrade prompt when you go over
- Waitlist for full classes, calendar (.ics) export, and multiple dogs per household

## Making it real
| Piece | Option |
| --- | --- |
| Sign-in | Supabase / Firebase magic-link auth |
| Membership billing | Stripe Billing + Checkout + Customer Portal |
| Bookings | a `bookings` table with a per-class capacity check, synced to Stripe via webhooks |
| Email / calendar | Resend or Postmark |
| Hosting | GitHub Pages (this) |

Plain HTML/CSS/JS with no build step: `index.html`, `styles.css`, `app.js`.
