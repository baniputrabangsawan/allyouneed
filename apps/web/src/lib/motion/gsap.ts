import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { motion } from './config'

let registered = false

export function registerMotion() {
  if (registered || typeof window === 'undefined') return
  gsap.registerPlugin(useGSAP, Flip, ScrollTrigger)
  gsap.defaults({ duration: motion.duration.normal, ease: motion.ease.standard })
  registered = true
}

if (typeof window !== 'undefined') registerMotion()

export { Flip, ScrollTrigger, gsap, useGSAP }
