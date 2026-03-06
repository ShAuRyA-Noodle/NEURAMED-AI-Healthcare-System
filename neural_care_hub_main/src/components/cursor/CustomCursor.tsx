import React, { useEffect, useRef } from 'react'

export const CustomCursor: React.FC = () => {
    const dotRef = useRef<HTMLDivElement>(null)
    const ringRef = useRef<HTMLDivElement>(null)

    const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const ring = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const isHovering = useRef(false)

    useEffect(() => {
        document.body.style.cursor = 'none'

        const onMouseMove = (e: MouseEvent) => {
            mouse.current = { x: e.clientX, y: e.clientY }
            if (dotRef.current) {
                dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
            }

            const target = e.target as HTMLElement
            isHovering.current = !!target?.closest('[data-hover="true"], button, a, input')
        }

        const animate = () => {
            ring.current.x += (mouse.current.x - ring.current.x) * 0.1
            ring.current.y += (mouse.current.y - ring.current.y) * 0.1

            if (ringRef.current) {
                const scale = isHovering.current ? 1.8 : 1
                ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) scale(${scale})`
            }

            requestAnimationFrame(animate)
        }

        window.addEventListener('mousemove', onMouseMove)
        const renderId = requestAnimationFrame(animate)

        return () => {
            document.body.style.cursor = 'auto'
            window.removeEventListener('mousemove', onMouseMove)
            cancelAnimationFrame(renderId)
        }
    }, [])

    return (
        <>
            <div
                ref={dotRef}
                className="fixed top-0 left-0 w-[7px] h-[7px] bg-cyan-400 rounded-full pointer-events-none z-[9999] -ml-[3.5px] -mt-[3.5px]"
                style={{ willChange: 'transform' }}
            />
            <div
                ref={ringRef}
                className="fixed top-0 left-0 w-[30px] h-[30px] border border-cyan-400/50 rounded-full pointer-events-none z-[9998] transition-transform duration-100 ease-out -ml-[15px] -mt-[15px]"
                style={{ willChange: 'transform' }}
            />
        </>
    )
}
