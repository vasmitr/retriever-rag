'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useFormContext } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@renderer/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@renderer/components/ui/form'
import { Input } from '@renderer/components/ui/input'
import { useEffect } from 'react'

const formSchema = z.object({
  NODE_ENV: z.string().min(2, {
    message: 'Field must be filled'
  }),
  QDRANT_URL: z.string().min(2, {
    message: 'Field must be filled'
  }),
  OLLAMA_URL: z.string().min(2, {
    message: 'Field must be filled'
  })
})

export function ConfigForm({ config, onConfigChange }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    values: {
      NODE_ENV: config?.NODE_ENV || '',
      QDRANT_URL: config?.QDRANT_URL || '',
      OLLAMA_URL: config?.OLLAMA_URL || ''
    }
  })

  useEffect(() => {
    Object.entries(config).forEach(([key, value]) => {
      form.setValue(key, value)
    })
  }, [config, form])

  if (!config) {
    return null
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onConfigChange)} className="space-y-8 flex flex-col">
        <FormField
          control={form.control}
          name="NODE_ENV"
          render={({ field }) => (
            <FormItem>
              <FormLabel>NODE_ENV</FormLabel>
              <FormControl>
                <Input placeholder="production" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="QDRANT_URL"
          render={({ field }) => (
            <FormItem>
              <FormLabel>QDRANT_URL</FormLabel>
              <FormControl>
                <Input placeholder="localhost:6333" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="OLLAMA_URL"
          render={({ field }) => (
            <FormItem>
              <FormLabel>OLLAMA_URL</FormLabel>
              <FormControl>
                <Input placeholder="localhost:11434" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="self-end" type="submit">
          Save
        </Button>
      </form>
    </Form>
  )
}
