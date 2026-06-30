import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import GradientText from '../ui/GradientText';
import ScrollReveal from '../ui/ScrollReveal';
import { useCompanyStore } from '../../store/companyStore';

export default function CTASection() {
  const { companyName } = useCompanyStore();

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-900 overflow-hidden" id="cta">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* Section tag */}
          <div className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-500 bg-primary-500/10 border border-primary-500/20 rounded-full px-3.5 py-1 mb-5">
            Get Started
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gray-900 dark:text-white">
            Ready to Start
            <br />
            <GradientText type="primary">Trading?</GradientText>
          </h2>

          <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto">
            Join thousands of successful traders. Open your account in minutes and start trading today.
          </p>

          {/* Email form */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-6"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Input
              type="email"
              placeholder="Enter your email address"
              icon={Mail}
              className="flex-1"
            />
            <Button variant="gradient" size="lg" className="whitespace-nowrap">
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <p className="text-xs text-gray-500 mb-4">
              By signing up, you agree to our{' '}
              <Link to="/legal/terms" className="text-primary-400 hover:text-primary-300 transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/legal/privacy" className="text-primary-400 hover:text-primary-300 transition-colors">
                Privacy Policy
              </Link>
              . No credit card required.
            </p>
            <p className="text-sm text-gray-400">
              Or{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                create a live account
              </Link>
            </p>
          </motion.div>
        </motion.div>

        {/* Risk Disclaimer */}
        <motion.div
          className="mt-14 pt-8 border-t border-dark-700 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-xs text-gray-500 leading-relaxed text-center">
            CFD trading involves substantial risk of loss. Between 75–90% of retail investor accounts
            lose money when trading CFDs. You should not risk more than you can afford to lose.
            Leveraged products may not be suitable for all investors. Please ensure you fully understand
            the risks involved.{companyName ? ` ${companyName} is licensed and regulated by relevant financial authorities.` : ''}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
