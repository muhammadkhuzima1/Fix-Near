import React, { useState, useEffect } from 'react';
import { UserRole, ServiceRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SupabaseService } from '../../services/supabaseService';
import { store } from '../../services/store';
import {
  Wrench,
  Zap,
  Flame,
  Refrigerator,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Menu,
  X,
  Star,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  MessageSquare,
  AlertCircle,
  Send,
  UserCheck,
} from 'lucide-react';

import heroRepairImg from '../../assets/images/hero_home_repair_technician_1792151850806.jpg';
import plumbingImg from '../../assets/images/service_plumbing_repair_1792151850780.jpg';
import electricalImg from '../../assets/images/service_electrical_repair_1792151851213.jpg';
import hvacImg from '../../assets/images/service_hvac_repair_1792151852303.jpg';
import applianceImg from '../../assets/images/service_appliance_repair_1792323122099.jpg';

interface PublicFeedbackItem {
  id: string;
  ticketNumber: string;
  customerName: string;
  category: string;
  score: number;
  comment: string;
  createdAt: string;
  technicianName?: string;
}

interface PublicHomepageProps {
  onNavigateToAuth: (portal?: UserRole, mode?: 'signin' | 'signup') => void;
  onGoToDashboard?: () => void;
  onRequestService?: () => void;
}

export const PublicHomepage: React.FC<PublicHomepageProps> = ({
  onNavigateToAuth,
  onGoToDashboard,
  onRequestService,
}) => {
  const { currentUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Customer Feedback state
  const [feedbackList, setFeedbackList] = useState<PublicFeedbackItem[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [customerCompletedRequests, setCustomerCompletedRequests] = useState<ServiceRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [feedbackScore, setFeedbackScore] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Load genuine customer feedback from Supabase on mount
  const loadFeedback = async () => {
    try {
      setLoadingFeedback(true);
      const items = await SupabaseService.fetchPublicFeedback();
      setFeedbackList(items);
    } catch (err) {
      console.warn('Error loading public feedback:', err);
      setFeedbackList([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleRequestServiceClick = () => {
    if (onRequestService && currentUser) {
      onRequestService();
    } else if (currentUser) {
      if (onGoToDashboard) onGoToDashboard();
    } else {
      onNavigateToAuth('customer', 'signin');
    }
  };

  // Open Leave Feedback modal with customer validation
  const handleOpenFeedbackModal = async () => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setFeedbackComment('');
    setFeedbackScore(5);

    if (!currentUser) {
      setIsFeedbackModalOpen(true);
      return;
    }

    if (currentUser.role !== 'customer') {
      setFeedbackError('Feedback submission is reserved for customer accounts with completed repairs.');
      setIsFeedbackModalOpen(true);
      return;
    }

    try {
      const allRequests = await SupabaseService.fetchServiceRequests();
      const customerCompleted = allRequests.filter(
        (r) => r.customerId === currentUser.id && r.status === 'completed'
      );
      setCustomerCompletedRequests(customerCompleted);
      if (customerCompleted.length > 0) {
        // Default to first completed request that doesn't have feedback yet, or the first one
        const unreviewed = customerCompleted.find((r) => !r.rating || !r.rating.comment);
        const initial = unreviewed || customerCompleted[0];
        setSelectedRequestId(initial.id);
        if (initial.rating?.score) {
          setFeedbackScore(initial.rating.score);
        }
        if (initial.rating?.comment) {
          setFeedbackComment(initial.rating.comment);
        }
      }
    } catch (err) {
      console.error('Error fetching customer completed requests:', err);
      // Fallback to store
      const storeRequests = store.getRequests().filter(
        (r) => r.customerId === currentUser.id && r.status === 'completed'
      );
      setCustomerCompletedRequests(storeRequests);
      if (storeRequests.length > 0) {
        setSelectedRequestId(storeRequests[0].id);
      }
    }

    setIsFeedbackModalOpen(true);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onNavigateToAuth('customer', 'signin');
      return;
    }

    if (!selectedRequestId) {
      setFeedbackError('Please select a completed service request.');
      return;
    }

    if (!feedbackComment.trim()) {
      setFeedbackError('Please provide a short comment describing your service experience.');
      return;
    }

    try {
      setSubmittingFeedback(true);
      setFeedbackError(null);

      const result = await SupabaseService.rateServiceRequest(
        selectedRequestId,
        {
          score: feedbackScore,
          comment: feedbackComment.trim(),
        },
        currentUser
      );

      if (result.success) {
        setFeedbackSuccess('Thank you! Your feedback has been recorded and published.');
        // Refresh feedback feed to immediately reflect real data
        await loadFeedback();
        setTimeout(() => {
          setIsFeedbackModalOpen(false);
          setFeedbackSuccess(null);
        }, 2200);
      } else {
        setFeedbackError(result.error || 'Unable to save feedback to the database.');
      }
    } catch (err: any) {
      setFeedbackError(err.message || 'An error occurred while saving your feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Supported service categories (4 clean, essential cards)
  const services = [
    {
      id: 'plumbing',
      title: 'Plumbing',
      icon: <Wrench className="w-5 h-5 text-[#143628]" />,
      description:
        'Fast diagnostics and repairs for pipe leaks, water heaters, clogged drains, and kitchen or bathroom fixtures.',
      hourlyRate: 'PKR 2,000/hour',
      image: plumbingImg,
    },
    {
      id: 'electrical',
      title: 'Electrical',
      icon: <Zap className="w-5 h-5 text-[#143628]" />,
      description:
        'Certified troubleshooting for tripping breakers, faulty outlets, light fixture installations, and residential wiring.',
      hourlyRate: 'PKR 2,200/hour',
      image: electricalImg,
    },
    {
      id: 'hvac',
      title: 'AC & HVAC',
      icon: <Flame className="w-5 h-5 text-[#143628]" />,
      description:
        'Expert cooling and heating maintenance, air conditioner servicing, thermostat calibration, and airflow repair.',
      hourlyRate: 'PKR 2,500/hour',
      image: hvacImg,
    },
    {
      id: 'appliance',
      title: 'Appliance Repair',
      icon: <Refrigerator className="w-5 h-5 text-[#143628]" />,
      description:
        'Reliable repair service for refrigerators, washing machines, dryers, dishwashers, and major kitchen appliances.',
      hourlyRate: 'PKR 2,000/hour',
      image: applianceImg,
    },
  ];

  // How It Works Steps (Exactly 3 simple steps)
  const steps = [
    {
      number: '01',
      title: 'Tell Us the Problem',
      description: 'Describe the repair in your own words. No technical terms or trade codes required.',
    },
    {
      number: '02',
      title: 'Get a Suitable Technician',
      description: 'Our system analyzes your problem and matches an available, certified technician.',
    },
    {
      number: '03',
      title: 'Track Your Repair',
      description: 'Follow real-time progress, from technician dispatch until the job is completed.',
    },
  ];

  // Why FixNear (3 short benefits)
  const benefits = [
    {
      title: 'AI-Assisted Problem Understanding',
      description:
        'State your issue naturally. FixNear identifies the category, priority level, and required trade skills instantly.',
      icon: <Sparkles className="w-6 h-6 text-[#143628]" />,
    },
    {
      title: 'Suitable Technician Matching',
      description:
        'We match vetted technicians based on trade competence, active availability, and real workload balance.',
      icon: <UserCheck className="w-6 h-6 text-[#143628]" />,
    },
    {
      title: 'Request Tracking and Email Updates',
      description:
        'Stay informed at every milestone with transparent PKR hourly pricing, real-time status, and job logs.',
      icon: <ShieldCheck className="w-6 h-6 text-[#143628]" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F2421] selection:bg-[#143628] selection:text-white flex flex-col font-sans">
      {/* 1. HEADER */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E8E2D8] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            {/* FixNear Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex items-center gap-2.5 text-left cursor-pointer focus:outline-none group"
              >
                <div className="w-9 h-9 rounded-lg bg-[#143628] text-[#FDFBF7] flex items-center justify-center font-serif font-bold text-lg shadow-xs group-hover:bg-[#1B4332] transition-colors">
                  F
                </div>
                <div className="flex flex-col">
                  <span className="font-serif font-bold text-2xl tracking-tight text-[#143628]">
                    FixNear
                  </span>
                </div>
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-[#4A554E]">
              <button
                onClick={() => scrollToSection('services')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('why-fixnear')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                Why FixNear
              </button>
              <button
                onClick={() => scrollToSection('customer-feedback')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                Customer Feedback
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                About
              </button>
            </nav>

            {/* Actions */}
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              {currentUser ? (
                <button
                  onClick={onGoToDashboard}
                  className="px-4 py-2.5 text-sm font-medium text-[#143628] hover:bg-[#EFEAE1] rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>My Dashboard</span>
                </button>
              ) : (
                <button
                  onClick={() => onNavigateToAuth('customer', 'signin')}
                  className="px-4 py-2 text-sm font-medium text-[#2C3830] hover:text-[#143628] hover:bg-[#EFEAE1] rounded-lg transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              )}

              <button
                onClick={handleRequestServiceClick}
                className="px-5 py-2.5 bg-[#143628] hover:bg-[#1B4332] text-[#FDFBF7] text-sm font-medium rounded-lg transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span>Request a Service</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#2C3830] hover:text-[#143628] hover:bg-[#EFEAE1] rounded-lg lg:hidden cursor-pointer"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E8E2D8] bg-[#FAF8F5] px-4 pt-4 pb-6 space-y-4 shadow-lg">
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => scrollToSection('services')}
                className="text-left px-3 py-2.5 text-sm font-medium text-[#2C3830] hover:bg-[#EFEAE1] rounded-lg"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="text-left px-3 py-2.5 text-sm font-medium text-[#2C3830] hover:bg-[#EFEAE1] rounded-lg"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('why-fixnear')}
                className="text-left px-3 py-2.5 text-sm font-medium text-[#2C3830] hover:bg-[#EFEAE1] rounded-lg"
              >
                Why FixNear
              </button>
              <button
                onClick={() => scrollToSection('customer-feedback')}
                className="text-left px-3 py-2.5 text-sm font-medium text-[#2C3830] hover:bg-[#EFEAE1] rounded-lg"
              >
                Customer Feedback
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="text-left px-3 py-2.5 text-sm font-medium text-[#2C3830] hover:bg-[#EFEAE1] rounded-lg"
              >
                About
              </button>
            </div>
            <div className="pt-3 border-t border-[#E8E2D8] flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleRequestServiceClick();
                }}
                className="w-full py-2.5 bg-[#143628] text-[#FDFBF7] font-medium text-sm rounded-lg text-center shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>Request a Service</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              {currentUser ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onGoToDashboard) onGoToDashboard();
                  }}
                  className="w-full py-2.5 border border-[#D5CFC5] text-[#2C3830] font-medium text-sm rounded-lg text-center hover:bg-[#EFEAE1]"
                >
                  Go to My Dashboard
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNavigateToAuth('customer', 'signin');
                  }}
                  className="w-full py-2.5 border border-[#D5CFC5] text-[#2C3830] font-medium text-sm rounded-lg text-center hover:bg-[#EFEAE1]"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden bg-[#FAF8F5] pt-12 sm:pt-20 pb-16 sm:pb-24 border-b border-[#E8E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#143628] bg-[#EAE4D9] px-3 py-1 rounded-md border border-[#D8CFBE]">
                <span>Verified Field Service</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-6xl font-bold text-[#143628] leading-[1.1] tracking-tight">
                Home Repairs, Made Simple.
              </h1>

              <p className="text-base sm:text-lg text-[#3E4A42] leading-relaxed max-w-2xl font-normal">
                Tell us what needs fixing. FixNear helps identify the problem, match you with a
                suitable technician, and keep you updated until the job is complete.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <button
                  onClick={handleRequestServiceClick}
                  className="px-7 py-3.5 bg-[#143628] hover:bg-[#1B4332] text-[#FDFBF7] font-medium text-base rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Request a Service</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => scrollToSection('services')}
                  className="px-7 py-3.5 bg-[#F4EFEA] hover:bg-[#EBE4DC] text-[#143628] border border-[#D5CFC5] font-medium text-base rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Explore Services</span>
                </button>
              </div>

              {/* Reassurance pills */}
              <div className="pt-6 border-t border-[#E8E2D8] flex flex-wrap gap-6 text-xs text-[#526056]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#143628] shrink-0" />
                  <span>AI Problem Categorization</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#143628] shrink-0" />
                  <span>Verified Skill Matching</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#143628] shrink-0" />
                  <span>Transparent PKR Rates</span>
                </div>
              </div>
            </div>

            {/* Right Column: High-Quality Home Repair Photography */}
            <div className="lg:col-span-5 w-full">
              <div className="relative rounded-2xl overflow-hidden shadow-md border border-[#E3DCD1] bg-[#F4EFEA]">
                <img
                  src={heroRepairImg}
                  alt="Professional certified technician repairing residential fixture"
                  referrerPolicy="no-referrer"
                  className="w-full h-80 sm:h-96 lg:h-[440px] object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#143628]/85 via-black/20 to-transparent flex flex-col justify-end p-6 text-[#FDFBF7]">
                  <div className="text-xs uppercase tracking-wider font-semibold text-[#D4E8DC] mb-1">
                    Certified Technicians
                  </div>
                  <div className="font-serif text-lg sm:text-xl font-bold leading-snug">
                    Safe, high-quality workmanship for plumbing, electrical, HVAC, and appliances.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. OUR SERVICES (4 Clean Cards) */}
      <section id="services" className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-[#E8E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#143628] bg-[#EAE4D9] px-3 py-1 rounded-md border border-[#D8CFBE]">
              Professional Repair Categories
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#143628]">
              Our Services
            </h2>
            <p className="text-sm sm:text-base text-[#4A554E] leading-relaxed">
              Standardized hourly rates in Pakistani Rupees (PKR) with certified technicians dispatched directly to your door.
            </p>
          </div>

          {/* 4 Clean Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl border border-[#E8E2D8] overflow-hidden hover:border-[#143628]/40 hover:shadow-md transition-all flex flex-col group"
              >
                <div className="h-44 w-full overflow-hidden bg-[#F4EFEA] relative">
                  <img
                    src={service.image}
                    alt={service.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 bg-[#143628]/90 text-[#FDFBF7] text-xs font-mono font-semibold px-2.5 py-1 rounded shadow-xs">
                    {service.hourlyRate}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-[#F4EFEA] text-[#143628]">
                        {service.icon}
                      </div>
                      <h3 className="font-serif text-xl font-bold text-[#143628]">
                        {service.title}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-[#4A554E] leading-relaxed line-clamp-3">
                      {service.description}
                    </p>
                  </div>

                  <button
                    onClick={handleRequestServiceClick}
                    className="w-full py-2.5 text-xs font-medium text-[#143628] bg-[#FAF8F5] hover:bg-[#143628] hover:text-[#FDFBF7] border border-[#DDD5C7] rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Request Service</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS (Exactly 3 Simple Steps) */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-[#F5F2EB] border-b border-[#E8E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#143628] bg-[#EAE4D9] px-3 py-1 rounded-md border border-[#D8CFBE]">
              Simple Three-Step Process
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#143628]">
              How It Works
            </h2>
            <p className="text-sm sm:text-base text-[#4A554E] leading-relaxed">
              We took the complexity out of home maintenance. From first report to final sign-off:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div
                key={step.number}
                className="bg-white p-7 sm:p-8 rounded-xl border border-[#E8E2D8] space-y-4 shadow-xs hover:border-[#143628]/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="font-serif text-3xl font-bold text-[#143628] opacity-75">
                    {step.number}
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#143628]">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#4A554E] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. WHY FIXNEAR (3 Short Benefits) */}
      <section id="why-fixnear" className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-[#E8E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#143628] bg-[#EAE4D9] px-3 py-1 rounded-md border border-[#D8CFBE]">
              The FixNear Difference
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#143628]">
              Why FixNear
            </h2>
            <p className="text-sm sm:text-base text-[#4A554E] leading-relaxed">
              Designed to eliminate guesswork, unverified quotes, and unreliable scheduling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((b, idx) => (
              <div
                key={idx}
                className="bg-white p-7 sm:p-8 rounded-xl border border-[#E8E2D8] space-y-4 shadow-xs hover:border-[#143628]/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-lg bg-[#EAE4D9] flex items-center justify-center">
                    {b.icon}
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#143628]">
                    {b.title}
                  </h3>
                  <p className="text-sm text-[#4A554E] leading-relaxed">
                    {b.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CUSTOMER FEEDBACK (WHAT CUSTOMERS SAY) */}
      <section id="customer-feedback" className="py-16 sm:py-24 bg-[#F5F2EB] border-b border-[#E8E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-2">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#143628] bg-[#EAE4D9] px-3 py-1 rounded-md border border-[#D8CFBE]">
                Verified Customer Reviews
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#143628]">
                What Customers Say
              </h2>
              <p className="text-sm text-[#4A554E]">
                Genuine reviews submitted by verified customers upon completed service requests.
              </p>
            </div>

            <button
              onClick={handleOpenFeedbackModal}
              className="self-start sm:self-auto px-5 py-2.5 bg-[#143628] hover:bg-[#1B4332] text-[#FDFBF7] text-sm font-medium rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Leave Feedback</span>
            </button>
          </div>

          {/* Feedback Content Area */}
          {loadingFeedback ? (
            <div className="bg-white p-10 rounded-xl border border-[#E8E2D8] text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#143628] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#69776E]">Loading verified reviews from database...</p>
            </div>
          ) : feedbackList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {feedbackList.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-6 rounded-xl border border-[#E8E2D8] space-y-4 shadow-xs flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Star Rating Display */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= item.score
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-stone-300'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-semibold text-[#143628] ml-1.5">
                        {item.score}.0
                      </span>
                    </div>

                    {/* Review Comment */}
                    <p className="text-sm text-[#2C3830] leading-relaxed italic">
                      "{item.comment}"
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#F0EBE3] flex items-center justify-between text-xs text-[#526056]">
                    <div>
                      <div className="font-semibold text-[#143628]">{item.customerName}</div>
                      <div className="capitalize text-[11px] text-[#69776E]">
                        {item.category} Repair · {item.ticketNumber}
                      </div>
                    </div>
                    {item.technicianName && (
                      <div className="text-right text-[11px] text-[#69776E]">
                        Tech: {item.technicianName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Honest, Empty State with zero invented data */
            <div className="bg-white p-8 sm:p-12 rounded-xl border border-[#E8E2D8] text-center max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#FAF8F5] text-[#143628] border border-[#E8E2D8] flex items-center justify-center mx-auto">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-serif text-lg font-bold text-[#143628]">
                  No Customer Reviews Yet
                </h3>
                <p className="text-xs sm:text-sm text-[#4A554E] max-w-md mx-auto leading-relaxed">
                  We show only genuine customer ratings recorded in our database after a job is completed.
                  If you have a completed repair with FixNear, share your review below.
                </p>
              </div>
              <button
                onClick={handleOpenFeedbackModal}
                className="px-5 py-2.5 bg-[#FAF8F5] hover:bg-[#143628] hover:text-[#FDFBF7] text-[#143628] text-xs font-medium rounded-lg border border-[#D5CFC5] transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Leave Feedback</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 7. ABOUT SECTION */}
      <section id="about" className="py-16 sm:py-24 bg-[#FAF8F5] border-b border-[#E8E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#143628] bg-[#EAE4D9] px-3 py-1 rounded-md border border-[#D8CFBE]">
              About FixNear
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#143628]">
              Built to elevate residential maintenance standards.
            </h2>
            <p className="text-base text-[#4A554E] leading-relaxed">
              FixNear is a field service management platform that removes friction from home repairs.
              We provide a single accountable workflow connecting homeowners, specialist field
              technicians, and operations managers.
            </p>
            <p className="text-sm text-[#4A554E] leading-relaxed">
              Every technician is vetted for trade competence. Every repair milestone is tracked
              in real time, and all pricing is displayed transparently in Pakistani Rupees (PKR)
              with honest labor time and documented parts costs.
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-8 text-sm text-[#143628] font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#143628]" />
                <span>No hidden markups</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#143628]" />
                <span>Verified credentials</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#143628]" />
                <span>Transparent PKR pricing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FINAL CALL TO ACTION */}
      <section className="py-16 sm:py-24 bg-[#143628] text-[#FDFBF7]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-serif text-3xl sm:text-5xl font-bold leading-tight text-[#FAF8F5]">
            Need Something Fixed?
          </h2>

          <p className="text-base sm:text-lg text-[#C8DCD1] max-w-xl mx-auto leading-relaxed">
            Tell us what is wrong, and let FixNear help you with the next step.
          </p>

          <div className="pt-4">
            <button
              onClick={handleRequestServiceClick}
              className="px-8 py-4 bg-[#FDFBF7] hover:bg-white text-[#143628] font-medium text-base rounded-lg transition-all shadow-md hover:shadow-lg inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Request a Service</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 9. MINIMAL FOOTER */}
      <footer className="bg-[#FAF8F5] border-t border-[#E8E2D8] py-12 text-[#526056] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#E8E2D8]">
            {/* Wordmark */}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[#143628] text-[#FDFBF7] flex items-center justify-center font-serif font-bold text-sm">
                F
              </div>
              <span className="font-serif font-bold text-lg text-[#143628]">FixNear</span>
            </div>

            {/* Navigation links in footer */}
            <nav className="flex flex-wrap items-center gap-6 font-medium text-[#4A554E]">
              <button
                onClick={() => scrollToSection('services')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection('how-it-works')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollToSection('customer-feedback')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                Customer Feedback
              </button>
              <button
                onClick={() => scrollToSection('about')}
                className="hover:text-[#143628] transition-colors cursor-pointer"
              >
                About
              </button>
              {currentUser ? (
                <button
                  onClick={onGoToDashboard}
                  className="hover:text-[#143628] transition-colors cursor-pointer"
                >
                  Dashboard
                </button>
              ) : (
                <button
                  onClick={() => onNavigateToAuth('customer', 'signin')}
                  className="hover:text-[#143628] transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              )}
            </nav>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500">
            <div>© {new Date().getFullYear()} FixNear. All rights reserved.</div>
            <div>Transparent PKR Pricing Standard.</div>
          </div>
        </div>
      </footer>

      {/* LEAVE FEEDBACK MODAL (Customer Only & Completed Requests Only) */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E8E2D8] max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#E8E2D8] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#EAE4D9] text-[#143628]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#143628]">
                    Leave Customer Feedback
                  </h3>
                  <p className="text-xs text-[#526056]">
                    Verified review for your completed repair
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFeedbackModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If user is not logged in */}
            {!currentUser ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#FAF8F5] text-[#143628] border border-[#E8E2D8] flex items-center justify-center mx-auto">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-[#143628]">Sign In Required</h4>
                  <p className="text-xs text-[#4A554E] max-w-sm mx-auto">
                    To maintain 100% genuine reviews, only verified customers with completed service orders can submit feedback.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsFeedbackModalOpen(false);
                      onNavigateToAuth('customer', 'signin');
                    }}
                    className="px-5 py-2.5 bg-[#143628] text-white text-xs font-medium rounded-lg hover:bg-[#1B4332]"
                  >
                    Sign In to Customer Account
                  </button>
                  <button
                    onClick={() => setIsFeedbackModalOpen(false)}
                    className="px-4 py-2.5 border border-[#D5CFC5] text-xs font-medium rounded-lg text-[#4A554E] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : currentUser.role !== 'customer' ? (
              /* If logged in as non-customer */
              <div className="text-center py-6 space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
                <h4 className="font-semibold text-sm text-[#143628]">Customer Role Only</h4>
                <p className="text-xs text-[#4A554E]">
                  You are currently signed in as a <span className="font-semibold capitalize">{currentUser.role}</span>.
                  Customer reviews can only be submitted by customer accounts on completed repair orders.
                </p>
                <button
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2 bg-[#143628] text-white text-xs font-medium rounded-lg"
                >
                  Close
                </button>
              </div>
            ) : customerCompletedRequests.length === 0 ? (
              /* Customer has no completed requests */
              <div className="text-center py-6 space-y-3">
                <AlertCircle className="w-10 h-10 text-stone-400 mx-auto" />
                <h4 className="font-semibold text-sm text-[#143628]">
                  No Completed Service Requests
                </h4>
                <p className="text-xs text-[#4A554E] max-w-sm mx-auto">
                  Feedback can only be submitted once a technician completes your service request.
                  You currently have no completed requests under your account.
                </p>
                <button
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="px-4 py-2 border border-[#D5CFC5] text-xs font-medium rounded-lg text-[#4A554E]"
                >
                  Close
                </button>
              </div>
            ) : (
              /* Customer has completed requests - Form */
              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                {feedbackError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{feedbackError}</span>
                  </div>
                )}

                {feedbackSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{feedbackSuccess}</span>
                  </div>
                )}

                {/* Service Request Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#2C3830]">
                    Select Completed Service Request:
                  </label>
                  <select
                    value={selectedRequestId}
                    onChange={(e) => {
                      const reqId = e.target.value;
                      setSelectedRequestId(reqId);
                      const found = customerCompletedRequests.find((r) => r.id === reqId);
                      if (found?.rating) {
                        setFeedbackScore(found.rating.score);
                        setFeedbackComment(found.rating.comment || '');
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-[#D5CFC5] bg-white text-[#2C3830] focus:outline-none focus:border-[#143628]"
                  >
                    {customerCompletedRequests.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.ticketNumber} — {req.title} ({req.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Star Rating Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#2C3830]">
                    Your Rating:
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackScore(star)}
                        className="p-1 hover:scale-110 transition-transform cursor-pointer"
                        title={`${star} Star${star > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= feedbackScore
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-stone-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-semibold text-[#143628] ml-2">
                      {feedbackScore} of 5 Stars
                    </span>
                  </div>
                </div>

                {/* Written Comment Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#2C3830]">
                    Written Comment:
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Describe the technician's professionalism, timeliness, and repair quality..."
                    className="w-full text-xs p-3 rounded-lg border border-[#D5CFC5] bg-white text-[#2C3830] placeholder-stone-400 focus:outline-none focus:border-[#143628]"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E2D8]">
                  <button
                    type="button"
                    onClick={() => setIsFeedbackModalOpen(false)}
                    className="px-4 py-2 border border-[#D5CFC5] text-xs font-medium rounded-lg text-[#4A554E] hover:bg-[#FAF8F5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="px-5 py-2 bg-[#143628] hover:bg-[#1B4332] text-[#FDFBF7] text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submittingFeedback ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Feedback</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
