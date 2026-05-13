Auth (user.auth.controller.js)
1. Register          →  create new user
2. Login             →  phone + password
3. Logout            →  clear refresh token
4. Refresh Token     →  get new access token
5. Send OTP          →  phone verification
6. Verify OTP        →  confirm phone number

Profile (user.profile.controller.js)
7.  Get my profile        →  get logged in user info
8.  Update profile        →  name, avatar, dob, gender
9.  Change password       →  old + new password
10. Update payment method →  cash, khalti, esewa, wallet
11. Delete account        →  soft delete (status: banned)

Location (user.location.controller.js)
12. Update current location  →  when booking trip
13. Get saved addresses      →  home, work, other
14. Add saved address        →  new address
15. Delete saved address     →  remove one

Driver Application (user.driver.controller.js)
16. Apply to become driver   →  creates DriverProfile
17. Check application status →  pending/approved/rejected

Wallet (user.wallet.controller.js)
18. Get wallet balance     →  current balance
19. Top up wallet          →  add money
20. Get transaction history →  all wallet transactions

Subscription (user.subscription.controller.js)
21. Get my subscription     →  current plan details
22. Cancel subscription     →  cancel plan

Ratings & Reviews (user.review.controller.js)
23. Rate driver after trip  →  give rating + comment
24. Get my reviews          →  reviews given by me

Notifications (user.notification.controller.js)
25. Get all notifications   →  list
26. Mark as read            →  single notification
27. Mark all as read        →  all at once
28. Delete notification     →  remove one

Support (user.support.controller.js)
29. Create support ticket   →  raise issue
30. Get my tickets          →  list all my tickets
31. Get single ticket       →  with chat history
32. Reply to ticket         →  add message to thread
33. Close ticket            →  mark as resolved

Trip History (user.trip.controller.js)
34. Get my trip history     →  all past trips
35. Get single trip detail  →  one trip full info
36. Cancel active trip      →  cancel pending trip