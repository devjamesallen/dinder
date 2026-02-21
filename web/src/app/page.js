"use client";

import { useState, useRef, useCallback } from "react";

/* ───────────────────────────────────────────
   SVG Icons (inline — no external icon CDN)
   ─────────────────────────────────────────── */

function IconArrowRight({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function IconCheck({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconUtensils({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function IconChefHat({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
      <path d="M6 17h12" />
    </svg>
  );
}

function IconShoppingCart({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/* ───────────────────────────────────────────
   Phone frame component
   ─────────────────────────────────────────── */

function PhoneFrame({ children, className = "", src, alt }) {
  const content = children || (
    <img src={src} alt={alt} className="w-full h-full object-cover object-top block" />
  );
  return (
    <div className={`relative mx-auto ${className}`} style={{ maxWidth: 280 }}>
      {/* Phone bezel — thin border, tight radius */}
      <div className="rounded-[1.2rem] border-4 border-gray-800 bg-gray-800 shadow-2xl overflow-hidden">
        {/* Screen — minimal radius so corners don't clip nav text */}
        <div
          className="rounded-[0.6rem] overflow-hidden bg-white relative"
          style={{ aspectRatio: "468 / 975" }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   How-it-works step component
   ─────────────────────────────────────────── */

function Step({ number, title, description, screenshot, alt }) {
  const isEven = number % 2 === 0;
  return (
    <div className={`flex flex-col md:flex-row items-center gap-10 ${isEven ? "md:flex-row-reverse" : ""}`}>
      <div className="flex-1">
        <div className="flex gap-4 items-start">
          <div
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #FF6B35, #C41E3A)" }}
          >
            {number}
          </div>
          <div>
            <h3 className="font-semibold text-xl text-gray-900">{title}</h3>
            <p className="text-gray-600 mt-2 text-lg leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
      {screenshot && (
        <div className="shrink-0">
          <PhoneFrame src={screenshot} alt={alt} className="w-52" />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────
   Screenshot carousel for features
   ─────────────────────────────────────────── */

function ScreenshotCarousel({ images }) {
  const [current, setCurrent] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);
  const containerRef = useRef(null);

  const SWIPE_THRESHOLD = 50;

  const handleDragStart = useCallback((clientX) => {
    dragStart.current = clientX;
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback((clientX) => {
    if (dragStart.current === null) return;
    const diff = clientX - dragStart.current;
    setDragOffset(diff);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragStart.current === null) return;
    if (dragOffset < -SWIPE_THRESHOLD && current < images.length - 1) {
      setCurrent((c) => c + 1);
    } else if (dragOffset > SWIPE_THRESHOLD && current > 0) {
      setCurrent((c) => c - 1);
    }
    setDragOffset(0);
    setIsDragging(false);
    dragStart.current = null;
  }, [dragOffset, current, images.length]);

  // Mouse events
  const onMouseDown = (e) => { e.preventDefault(); handleDragStart(e.clientX); };
  const onMouseMove = (e) => { if (isDragging) handleDragMove(e.clientX); };
  const onMouseUp = () => handleDragEnd();
  const onMouseLeave = () => { if (isDragging) handleDragEnd(); };

  // Touch events
  const onTouchStart = (e) => handleDragStart(e.touches[0].clientX);
  const onTouchMove = (e) => handleDragMove(e.touches[0].clientX);
  const onTouchEnd = () => handleDragEnd();

  return (
    <div className="flex flex-col items-center gap-4">
      <PhoneFrame className="w-56">
        <div
          ref={containerRef}
          className="relative w-full h-full overflow-hidden select-none"
          style={{ cursor: images.length > 1 ? "grab" : "default", aspectRatio: "468 / 975" }}
          onMouseDown={images.length > 1 ? onMouseDown : undefined}
          onMouseMove={images.length > 1 ? onMouseMove : undefined}
          onMouseUp={images.length > 1 ? onMouseUp : undefined}
          onMouseLeave={images.length > 1 ? onMouseLeave : undefined}
          onTouchStart={images.length > 1 ? onTouchStart : undefined}
          onTouchMove={images.length > 1 ? onTouchMove : undefined}
          onTouchEnd={images.length > 1 ? onTouchEnd : undefined}
        >
          <div
            className="flex h-full"
            style={{
              width: `${images.length * 100}%`,
              transform: `translateX(calc(-${current * (100 / images.length)}% + ${dragOffset}px))`,
              transition: isDragging ? "none" : "transform 0.35s ease-out",
            }}
          >
            {images.map((img, i) => (
              <div key={i} className="h-full shrink-0" style={{ width: `${100 / images.length}%` }}>
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover object-top block pointer-events-none"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </PhoneFrame>

      {/* Dots + swipe hint */}
      {images.length > 1 && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  i === current ? "scale-125" : "bg-gray-300 hover:bg-gray-400"
                }`}
                style={i === current ? { background: "linear-gradient(135deg, #FF6B35, #C41E3A)" } : {}}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400">Swipe to explore</p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────
   Main page
   ─────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ─── Nav ─── */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/GrubSwipe_Icon.png" alt="GrubSwipe" className="h-10 w-auto object-contain" />
            <img src="/GrubSwipe_words.png" alt="GrubSwipe" className="h-7 w-auto object-contain hidden sm:block" />
          </a>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition hidden sm:block">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-gray-900 transition hidden sm:block">
              How It Works
            </a>
            <a
              href="#download"
              className="text-sm font-semibold text-white px-4 py-2 rounded-full transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #FF6B35, #C41E3A)" }}
            >
              Get the App
            </a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-24 px-6" style={{ background: "linear-gradient(180deg, #FFF8F0 0%, white 100%)" }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight">
              Swipe Right{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #FF6B35, #C41E3A)" }}
              >
                on Dinner
              </span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 leading-relaxed max-w-lg">
              Can&apos;t decide where to eat? Swipe on restaurants and recipes — solo or
              with your group. When everyone agrees, it&apos;s a match.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#download"
                className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-full text-lg transition hover:opacity-90 hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #FF6B35, #C41E3A)" }}
              >
                Download Free
                <IconArrowRight className="w-5 h-5" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-full text-lg border-2 border-gray-200 text-gray-700 hover:border-gray-400 transition"
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Hero phone mockup — landing screen */}
          <div className="flex justify-center">
            <PhoneFrame src="/Landing_light.png" alt="GrubSwipe app home screen" className="w-64" />
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Three Ways to{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #FF6B35, #C41E3A)" }}
              >
                Decide What&apos;s for Dinner
              </span>
            </h2>
            <p className="mt-4 text-gray-600 text-lg max-w-2xl mx-auto">
              Whether you&apos;re going out, cooking in, or grocery shopping — GrubSwipe
              makes the decision easy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Eat Out */}
            <div className="flex flex-col items-center text-center">
              <ScreenshotCarousel
                images={[
                  { src: "/EatOut_swipCard.png", alt: "Swipe on restaurants" },
                  { src: "/EatOut_match.png", alt: "It's a match!" },
                ]}
              />
              <div className="mt-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "linear-gradient(135deg, #FF6B3520, #C41E3A20)" }}
                >
                  <IconUtensils className="w-6 h-6" style={{ color: "#FF6B35" }} />
                </div>
                <h3 className="text-xl font-bold mb-2">Eat Out</h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Swipe on nearby restaurants. When your group agrees, it&apos;s a
                  match — no more &quot;where do you want to go?&quot;
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-gray-500">
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Real-time group matching
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Photos, ratings &amp; distance
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    One-tap directions
                  </li>
                </ul>
              </div>
            </div>

            {/* Eat In */}
            <div className="flex flex-col items-center text-center">
              <ScreenshotCarousel
                images={[
                  { src: "/EatIn_swipeCard.png", alt: "Swipe on recipes" },
                  { src: "/Recipe.png", alt: "Full recipe view" },
                ]}
              />
              <div className="mt-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "linear-gradient(135deg, #FF6B3520, #C41E3A20)" }}
                >
                  <IconChefHat className="w-6 h-6" style={{ color: "#FF6B35" }} />
                </div>
                <h3 className="text-xl font-bold mb-2">Eat In</h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Browse recipes with a swipe. Like something? It goes straight to your
                  meal plan. Build a week of dinners in minutes.
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-gray-500">
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Thousands of recipes
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Swipe to meal plan
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Full ingredients &amp; steps
                  </li>
                </ul>
              </div>
            </div>

            {/* Meal Plan */}
            <div className="flex flex-col items-center text-center">
              <ScreenshotCarousel
                images={[
                  { src: "/MealPlan.png", alt: "Meal plan with selected recipes" },
                  { src: "/GroceryList.png", alt: "Smart grocery list" },
                ]}
              />
              <div className="mt-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "linear-gradient(135deg, #FF6B3520, #C41E3A20)" }}
                >
                  <IconShoppingCart className="w-6 h-6" style={{ color: "#FF6B35" }} />
                </div>
                <h3 className="text-xl font-bold mb-2">Meal Plan</h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Your liked recipes auto-generate a smart grocery list — ingredients
                  merged by aisle. Send it straight to Kroger Clicklist.
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-gray-500">
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Smart ingredient merging
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Grouped by aisle
                  </li>
                  <li className="flex items-center justify-center gap-2">
                    <IconCheck className="w-4 h-4 text-green-500 shrink-0" />
                    Kroger Clicklist integration
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Groups callout ─── */}
      <section className="py-20 px-6" style={{ background: "linear-gradient(135deg, #FFF8F0, #FFE8D6)" }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #FF6B35, #C41E3A)" }}
            >
              <IconUsers className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold mb-3">Better Together</h2>
            <p className="text-gray-700 text-lg leading-relaxed">
              Pair up with your partner or create a group with friends. Everyone swipes
              independently, and GrubSwipe finds what you all agree on. Share a simple
              6-character invite code to link up — it takes seconds.
            </p>
          </div>
          <div className="shrink-0">
            <PhoneFrame src="/MyGroups.png" alt="Groups screen with invite codes" className="w-56" />
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center mb-16">
            How It Works
          </h2>
          <div className="space-y-20">
            <Step
              number={1}
              title="Open GrubSwipe"
              description="Choose your mode: Eat Out for restaurants, Eat In for recipes, or jump to your Meal Plan."
              screenshot="/Landing_light.png"
              alt="GrubSwipe landing screen"
            />
            <Step
              number={2}
              title="Start Swiping"
              description="Swipe right on what sounds good, left to skip. See real photos, ratings, distance, and details for every restaurant and recipe."
              screenshot="/EatOut_swipCard.png"
              alt="Swiping on a restaurant"
            />
            <Step
              number={3}
              title="Match &amp; Go"
              description="When your group agrees on a restaurant, it's a match! For recipes, your liked picks build your meal plan automatically."
              screenshot="/EatOut_match.png"
              alt="It's a match screen"
            />
            <Step
              number={4}
              title="Shop Smart"
              description="Generate a merged grocery list from your meal plan — items grouped by aisle with similar ingredients combined. Send it straight to Kroger Clicklist."
              screenshot="/GroceryList.png"
              alt="Smart grocery list"
            />
          </div>
        </div>
      </section>

      {/* ─── Download CTA ─── */}
      <section
        id="download"
        className="py-24 px-6 text-center"
        style={{ background: "linear-gradient(135deg, #FF6B35, #C41E3A)" }}
      >
        <div className="max-w-2xl mx-auto">
          <img
            src="/GrubSwipe_Logo.png"
            alt="GrubSwipe"
            className="h-20 mx-auto mb-8 brightness-0 invert"
          />
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Dinner Decided in Seconds
          </h2>
          <p className="text-white/80 text-lg mb-10">
            Swipe, match, eat. Free on iOS and Android.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {/* Replace # with actual store links when available */}
            <a
              href="#"
              className="inline-flex items-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-full text-lg hover:bg-gray-50 transition"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.82 11.78 5.72 12.57 5.72C13.36 5.72 14.85 4.62 16.4 4.8C17.05 4.83 18.89 5.08 20.06 6.81C19.95 6.88 17.62 8.27 17.65 11.08C17.68 14.43 20.55 15.51 20.58 15.52C20.55 15.61 20.11 17.13 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
              </svg>
              App Store
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-full text-lg hover:bg-gray-50 transition"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.088 12l2.61-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z" />
              </svg>
              Google Play
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-10 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/GrubSwipe_Icon.png" alt="GrubSwipe" className="h-6 w-auto object-contain" />
            <span className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} GrubSwipe. All rights reserved.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-900 transition">Privacy</a>
            <a href="#" className="hover:text-gray-900 transition">Terms</a>
            <a href="mailto:devjamesallen@gmail.com" className="hover:text-gray-900 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
