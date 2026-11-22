# سلسلة · Silsila

الطفل بيشرح بكلامه ليش بتطلع نقط مي على الكاسة الباردة. الذكاء الاصطناعي بيفهم فكرته هو، والمرآة ثلاثية الأبعاد بترسمها،
وتجربة بعالمين (فكرته جنب الحقيقة) بتكسرها. بعدين الطفل بيعلّم نور، وشاشة المعلّم بتلخّص الصف.

## تشغيل
```bash
npm install
cp .env.example .env.local     # وحط ANTHROPIC_API_KEY (مفتاح API منفصل، مش اشتراك Claude)
npm run dev                    # http://localhost:5173  ·  شاشة المعلّم: /#/teacher
```
بدون مفتاح، التطبيق بيشتغل بالوضع الاحتياطي وبيكتب هيك فوق.

## فحص
```bash
npm run check      # الأنواع + الاختبارات + البناء
npm run eval       # دقة التشخيص على evals/utterances.json (الوضع الاحتياطي)
npm run eval:ai    # نفس الإشي مع Claude
```

## نشر على Vercel
اربطوا المستودع بـVercel (Framework: Vite)، وحطّوا `ANTHROPIC_API_KEY` بـEnvironment Variables. دوال `api/*.ts` بتنشر لحالها.

قوانين المشروع وتوزيع الشغل: `CLAUDE.md`.
