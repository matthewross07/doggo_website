# Adventure Dog Club — booking, but nice

An unofficial, good-natured demo of what booking drop-in dog training classes could feel like:
**enter your info once, then book any number of classes in one tap.**

Live: https://matthewross07.github.io/doggo_website/

Not affiliated with Summit Dog Training. No real classes are booked and no payments are processed.
Everything is stored in your browser's localStorage. Use **Reset** in the top bar to start over.

## What it shows
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
